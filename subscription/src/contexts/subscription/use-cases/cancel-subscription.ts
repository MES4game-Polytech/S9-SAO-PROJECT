import type { AuthenticatedUser } from '../../../shared/authenticated-user.js';
import type { EventPublisher } from '../domain/event-publisher.js';
import type { Subscription } from '../domain/subscription.js';
import {
  InvalidSubscriptionTransition,
  NotSubscriptionOwner,
  SubscriptionNotFound,
} from '../domain/subscription.errors.js';
import type { SubscriptionRepository } from '../domain/subscription.repository.js';
import { subscriptionCancelledEvent } from '../domain/subscription-events.js';

export interface CancelSubscriptionCommand {
  subscriptionId: string;
  requester: AuthenticatedUser;
  requestId?: string;
  now?: Date;
}

export class CancelSubscription {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly events: EventPublisher,
  ) {}

  async execute(command: CancelSubscriptionCommand): Promise<Subscription> {
    const subscription = await this.subscriptions.findById(command.subscriptionId);
    if (!subscription) throw new SubscriptionNotFound(command.subscriptionId);

    if (command.requester.role !== 'admin' && subscription.userId !== command.requester.userId) {
      throw new NotSubscriptionOwner(subscription.id, command.requester.userId);
    }

    const now = command.now ?? new Date();
    subscription.cancel(now); // lève si l'abonnement n'est pas ACTIVE

    const applied = await this.subscriptions.save(subscription, 'ACTIVE');
    if (!applied) {
      // L'état a changé entre la lecture et l'écriture : on dit lequel.
      const current = await this.subscriptions.findById(subscription.id);
      throw new InvalidSubscriptionTransition(
        subscription.id,
        current?.status ?? 'ACTIVE',
        'CANCELLED',
      );
    }

    await this.events.publish(
      subscriptionCancelledEvent(subscription, { requestId: command.requestId, now }),
    );

    return subscription;
  }
}
