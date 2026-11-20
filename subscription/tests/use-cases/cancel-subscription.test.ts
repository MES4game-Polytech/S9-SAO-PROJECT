import { describe, expect, it } from 'vitest';

import { Subscription } from '../../src/contexts/subscription/domain/subscription.js';
import {
  InvalidSubscriptionTransition,
  NotSubscriptionOwner,
} from '../../src/contexts/subscription/domain/subscription.errors.js';
import { CancelSubscription } from '../../src/contexts/subscription/use-cases/cancel-subscription.js';
import type { AuthenticatedUser } from '../../src/shared/authenticated-user.js';
import { InMemorySubscriptionRepository } from '../support/in-memory-subscription.repository.js';
import { RecordingEventPublisher } from '../support/recording-event-publisher.js';

const NOW = new Date('2026-11-17T09:00:00.000Z');
const LATER = new Date('2026-12-01T12:00:00.000Z');
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const SUBSCRIPTION_ID = '33333333-3333-4333-8333-333333333333';

const OWNER: AuthenticatedUser = { userId: OWNER_ID, role: 'user' };
const OTHER: AuthenticatedUser = { userId: OTHER_ID, role: 'user' };
const ADMIN: AuthenticatedUser = { userId: OTHER_ID, role: 'admin' };

async function setup(status: 'PENDING' | 'ACTIVE') {
  const subscriptions = new InMemorySubscriptionRepository();
  const events = new RecordingEventPublisher();

  const subscription = Subscription.create({
    id: SUBSCRIPTION_ID,
    userId: OWNER_ID,
    plan: 'PREMIUM_MONTHLY',
    now: NOW,
  });
  if (status === 'ACTIVE') subscription.activate('pay-1', NOW);
  await subscriptions.create(subscription);

  return { subscriptions, events, cancelSubscription: new CancelSubscription(subscriptions, events) };
}

describe('CancelSubscription', () => {
  it('annule un abonnement ACTIVE et publie l’événement', async () => {
    const { subscriptions, events, cancelSubscription } = await setup('ACTIVE');

    const cancelled = await cancelSubscription.execute({
      subscriptionId: SUBSCRIPTION_ID,
      requester: OWNER,
      requestId: 'req-9',
      now: LATER,
    });

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelledAt).toEqual(LATER);
    expect(events.published).toHaveLength(1);
    expect(events.published[0]).toMatchObject({
      type: 'subscription.cancelled',
      requestId: 'req-9',
      payload: {
        subscriptionId: SUBSCRIPTION_ID,
        userId: OWNER_ID,
        cancelledAt: LATER.toISOString(),
      },
    });

    const stored = await subscriptions.findById(SUBSCRIPTION_ID);
    expect(stored?.status).toBe('CANCELLED');
  });

  it('refuse d’annuler un abonnement qui n’est pas ACTIVE', async () => {
    const { events, cancelSubscription } = await setup('PENDING');

    await expect(
      cancelSubscription.execute({
        subscriptionId: SUBSCRIPTION_ID,
        requester: OWNER,
        now: LATER,
      }),
    ).rejects.toBeInstanceOf(InvalidSubscriptionTransition);

    expect(events.published).toHaveLength(0);
  });

  it('refuse un utilisateur qui n’est pas le propriétaire', async () => {
    const { cancelSubscription } = await setup('ACTIVE');

    await expect(
      cancelSubscription.execute({
        subscriptionId: SUBSCRIPTION_ID,
        requester: OTHER,
        now: LATER,
      }),
    ).rejects.toBeInstanceOf(NotSubscriptionOwner);
  });

  it('autorise un admin à annuler l’abonnement d’un autre', async () => {
    const { cancelSubscription } = await setup('ACTIVE');

    const cancelled = await cancelSubscription.execute({
      subscriptionId: SUBSCRIPTION_ID,
      requester: ADMIN,
      now: LATER,
    });

    expect(cancelled.status).toBe('CANCELLED');
  });
});
