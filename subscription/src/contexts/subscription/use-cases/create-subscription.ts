import type { EventPublisher } from '../domain/event-publisher.js';
import type { PaymentGateway } from '../domain/payment-gateway.js';
import { planDetails } from '../domain/subscription-plan.js';
import type { SubscriptionRepository } from '../domain/subscription.repository.js';
import { Subscription } from '../domain/subscription.js';
import { SubscriptionAlreadyPendingOrActive } from '../domain/subscription.errors.js';
import { subscriptionActivatedEvent } from '../domain/subscription-events.js';

export interface CreateSubscriptionCommand {
  userId: string;
  plan: string;
  requestId?: string;
  now?: Date;
}

export class CreateSubscription {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly payments: PaymentGateway,
    private readonly events: EventPublisher,
  ) {}

  async execute(command: CreateSubscriptionCommand): Promise<Subscription> {
    const existing = await this.subscriptions.findPendingOrActiveByUserId(command.userId);
    if (existing) {
      throw new SubscriptionAlreadyPendingOrActive(command.userId, existing.status);
    }

    const { plan } = planDetails(command.plan);
    const now = command.now ?? new Date();
    const subscription = Subscription.create({ userId: command.userId, plan, now });

    await this.subscriptions.create(subscription);

    const outcome = await this.payments.pay({
      referenceId: subscription.id,
      userId: subscription.userId,
      amountCents: subscription.priceCents,
      currency: subscription.currency,
    });

    if (outcome.status === 'FAILED') {
      subscription.fail(outcome.reason, now);
      await this.subscriptions.save(subscription, 'PENDING');
      return subscription;
    }

    subscription.activate(outcome.paymentId, now);

    // Toujours vrai juste après un create (id inconnu de quiconque), mais on
    // ne publie un fait que si la transition a réellement été enregistrée.
    const applied = await this.subscriptions.save(subscription, 'PENDING');
    if (applied) {
      await this.events.publish(
        subscriptionActivatedEvent(subscription, { requestId: command.requestId, now }),
      );
    }

    return subscription;
  }
}
