import { describe, expect, it } from 'vitest';

import {
  PaymentUnavailable,
  type PaymentOutcome,
} from '../../src/contexts/subscription/domain/payment-gateway.js';
import {
  SubscriptionAlreadyPendingOrActive,
  UnknownSubscriptionPlan,
} from '../../src/contexts/subscription/domain/subscription.errors.js';
//import { Subscription } from '../../src/contexts/subscription/domain/subscription.js';
import { CreateSubscription } from '../../src/contexts/subscription/use-cases/create-subscription.js';
import { FakePaymentGateway } from '../support/fake-payment-gateway.js';
import { InMemorySubscriptionRepository } from '../support/in-memory-subscription.repository.js';
import { RecordingEventPublisher } from '../support/recording-event-publisher.js';

const NOW = new Date('2026-11-17T09:00:00.000Z');
const USER_ID = '11111111-1111-4111-8111-111111111111';
const SUCCEEDED: PaymentOutcome = { status: 'SUCCEEDED', paymentId: 'pay-1' };

function setup(outcome: PaymentOutcome | Error) {
  const subscriptions = new InMemorySubscriptionRepository();
  const payments = new FakePaymentGateway(outcome);
  const events = new RecordingEventPublisher();

  return {
    subscriptions,
    payments,
    events,
    createSubscription: new CreateSubscription(subscriptions, payments, events),
  };
}

describe('CreateSubscription', () => {
  it('active l’abonnement quand le paiement réussit', async () => {
    const { subscriptions, payments, events, createSubscription } = setup(SUCCEEDED);

    const subscription = await createSubscription.execute({
      userId: USER_ID,
      plan: 'PREMIUM_MONTHLY',
      now: NOW,
      requestId: 'req-1',
    });

    expect(subscription.status).toBe('ACTIVE');
    expect(subscription.endsAt).toEqual(new Date('2026-12-17T09:00:00.000Z'));
    expect(payments.calls).toEqual([
      {
        referenceId: subscription.id,
        userId: USER_ID,
        amountCents: 499,
        currency: 'EUR',
      },
    ]);
    expect(events.published).toHaveLength(1);
    expect(events.published[0]).toMatchObject({
      type: 'subscription.activated',
      requestId: 'req-1',
      occurredAt: NOW.toISOString(),
      payload: {
        subscriptionId: subscription.id,
        userId: USER_ID,
        plan: 'PREMIUM_MONTHLY',
        startsAt: NOW.toISOString(),
        endsAt: '2026-12-17T09:00:00.000Z',
      },
    });

    const stored = await subscriptions.findById(subscription.id);
    expect(stored?.status).toBe('ACTIVE');
  });

  it('marque FAILED sans publier quand le paiement échoue', async () => {
    const { subscriptions, events, createSubscription } = setup({
      status: 'FAILED',
      paymentId: 'pay-2',
      reason: 'card_declined',
    });

    const subscription = await createSubscription.execute({
      userId: USER_ID,
      plan: 'PREMIUM_MONTHLY',
      now: NOW,
    });

    expect(subscription.status).toBe('FAILED');
    expect(subscription.failureReason).toBe('card_declined');
    expect(events.published).toHaveLength(0);

    const stored = await subscriptions.findById(subscription.id);
    expect(stored?.status).toBe('FAILED');
  });

  it('refuse un second abonnement PENDING ou ACTIVE', async () => {
    const { subscriptions, payments, createSubscription } = setup(SUCCEEDED);
    await createSubscription.execute({ userId: USER_ID, plan: 'PREMIUM_MONTHLY', now: NOW });

    await expect(
      createSubscription.execute({ userId: USER_ID, plan: 'PREMIUM_YEARLY', now: NOW }),
    ).rejects.toBeInstanceOf(SubscriptionAlreadyPendingOrActive);

    expect(payments.calls).toHaveLength(1);
    const page = await subscriptions.findPage({ page: 1, pageSize: 10 });
    expect(page.total).toBe(1);
  });

  it('refuse un plan inconnu sans rien persister', async () => {
    const { subscriptions, payments, createSubscription } = setup(SUCCEEDED);

    await expect(
      createSubscription.execute({ userId: USER_ID, plan: 'GOLD', now: NOW }),
    ).rejects.toBeInstanceOf(UnknownSubscriptionPlan);

    expect(payments.calls).toHaveLength(0);
    const page = await subscriptions.findPage({ page: 1, pageSize: 10 });
    expect(page.total).toBe(0);
  });

  it('laisse l’abonnement PENDING si le service payment est injoignable', async () => {
    const { subscriptions, payments, createSubscription } = setup(
      new PaymentUnavailable('unknown'),
    );

    await expect(
      createSubscription.execute({ userId: USER_ID, plan: 'PREMIUM_MONTHLY', now: NOW }),
    ).rejects.toBeInstanceOf(PaymentUnavailable);

    const id = payments.calls[0]?.referenceId as string;
    const stored = await subscriptions.findById(id);
    expect(stored?.status).toBe('PENDING');
  });
});
