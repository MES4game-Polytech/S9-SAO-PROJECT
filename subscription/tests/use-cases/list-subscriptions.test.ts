import { describe, expect, it } from 'vitest';

import { Subscription } from '../../src/contexts/subscription/domain/subscription.js';
import { ListSubscriptions } from '../../src/contexts/subscription/use-cases/list-subscriptions.js';
import type { AuthenticatedUser } from '../../src/shared/authenticated-user.js';
import { InMemorySubscriptionRepository } from '../support/in-memory-subscription.repository.js';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';

const OWNER: AuthenticatedUser = { userId: OWNER_ID, role: 'user' };
const ADMIN: AuthenticatedUser = { userId: OTHER_ID, role: 'admin' };

async function setup() {
  const subscriptions = new InMemorySubscriptionRepository();
  const days = (n: number) => new Date(Date.UTC(2026, 0, n));

  for (const [id, userId, day] of [
    ['sub-1', OWNER_ID, 1],
    ['sub-2', OWNER_ID, 2],
    ['sub-3', OTHER_ID, 3],
  ] as const) {
    await subscriptions.create(
      Subscription.create({ id, userId, plan: 'PREMIUM_MONTHLY', now: days(day) }),
    );
  }

  return { listSubscriptions: new ListSubscriptions(subscriptions) };
}

describe('ListSubscriptions', () => {
  it('ne renvoie que les abonnements du demandeur', async () => {
    const { listSubscriptions } = await setup();

    const page = await listSubscriptions.execute({
      requester: OWNER,
      page: 1,
      pageSize: 10,
    });

    expect(page.total).toBe(2);
    expect(page.items.map((s) => s.id)).toEqual(['sub-2', 'sub-1']);
  });

  it('renvoie tout à un admin', async () => {
    const { listSubscriptions } = await setup();

    const page = await listSubscriptions.execute({ requester: ADMIN, page: 1, pageSize: 10 });

    expect(page.total).toBe(3);
  });

  it('pagine et renvoie le total complet', async () => {
    const { listSubscriptions } = await setup();

    const page = await listSubscriptions.execute({ requester: ADMIN, page: 2, pageSize: 2 });

    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(3);
    expect(page.page).toBe(2);
    expect(page.pageSize).toBe(2);
  });
});
