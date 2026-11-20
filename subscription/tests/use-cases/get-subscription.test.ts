import { describe, expect, it } from 'vitest';

import { Subscription } from '../../src/contexts/subscription/domain/subscription.js';
import {
  NotSubscriptionOwner,
  SubscriptionNotFound,
} from '../../src/contexts/subscription/domain/subscription.errors.js';
import { GetSubscription } from '../../src/contexts/subscription/use-cases/get-subscription.js';
import type { AuthenticatedUser } from '../../src/shared/authenticated-user.js';
import { InMemorySubscriptionRepository } from '../support/in-memory-subscription.repository.js';

const NOW = new Date('2026-11-17T09:00:00.000Z');
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const SUBSCRIPTION_ID = '33333333-3333-4333-8333-333333333333';

const OWNER: AuthenticatedUser = { userId: OWNER_ID, role: 'user' };
const OTHER: AuthenticatedUser = { userId: OTHER_ID, role: 'user' };
const ADMIN: AuthenticatedUser = { userId: OTHER_ID, role: 'admin' };

async function setup() {
  const subscriptions = new InMemorySubscriptionRepository();
  await subscriptions.create(
    Subscription.create({
      id: SUBSCRIPTION_ID,
      userId: OWNER_ID,
      plan: 'PREMIUM_MONTHLY',
      now: NOW,
    }),
  );

  return { subscriptions, getSubscription: new GetSubscription(subscriptions) };
}

describe('GetSubscription', () => {
  it('renvoie l’abonnement à son propriétaire', async () => {
    const { getSubscription } = await setup();

    const subscription = await getSubscription.execute({
      subscriptionId: SUBSCRIPTION_ID,
      requester: OWNER,
    });

    expect(subscription.id).toBe(SUBSCRIPTION_ID);
  });

  it('renvoie 404 si l’abonnement n’existe pas', async () => {
    const { getSubscription } = await setup();

    await expect(
      getSubscription.execute({ subscriptionId: 'inconnu', requester: OWNER }),
    ).rejects.toBeInstanceOf(SubscriptionNotFound);
  });

  it('refuse un utilisateur qui n’est pas le propriétaire', async () => {
    const { getSubscription } = await setup();

    await expect(
      getSubscription.execute({ subscriptionId: SUBSCRIPTION_ID, requester: OTHER }),
    ).rejects.toBeInstanceOf(NotSubscriptionOwner);
  });

  it('autorise un admin à lire l’abonnement d’un autre', async () => {
    const { getSubscription } = await setup();

    const subscription = await getSubscription.execute({
      subscriptionId: SUBSCRIPTION_ID,
      requester: ADMIN,
    });

    expect(subscription.userId).toBe(OWNER_ID);
  });
});
