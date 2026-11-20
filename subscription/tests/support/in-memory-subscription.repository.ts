import type { SubscriptionQuery, SubscriptionRepository } from '../../src/contexts/subscription/domain/subscription.repository.js';
import type { SubscriptionStatus } from '../../src/contexts/subscription/domain/subscription-status.js';
import { Subscription, type SubscriptionProps } from '../../src/contexts/subscription/domain/subscription.js';
import type { Page } from '../../src/shared/page.js';

/**
 * Faux dépôt : stocke des copies (comme une base), rend des entités
 * reconstruites par `rehydrate`. Une instance modifiée par un test ne
 * contamine donc jamais ce qui est stocké.
 */
export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private readonly rows = new Map<string, SubscriptionProps>();

  async create(subscription: Subscription): Promise<void> {
    this.rows.set(subscription.id, subscription.toProps());
  }

  async save(subscription: Subscription, expectedStatus: SubscriptionStatus): Promise<boolean> {
    const current = this.rows.get(subscription.id);
    if (!current || current.status !== expectedStatus) return false;

    this.rows.set(subscription.id, subscription.toProps());
    return true;
  }

  async findById(id: string): Promise<Subscription | null> {
    const props = this.rows.get(id);
    return props ? Subscription.rehydrate(props) : null;
  }

  async findPendingOrActiveByUserId(userId: string): Promise<Subscription | null> {
    const found = [...this.rows.values()].find(
      (row) => row.userId === userId && (row.status === 'PENDING' || row.status === 'ACTIVE'),
    );

    return found ? Subscription.rehydrate(found) : null;
  }

  async findPage(query: SubscriptionQuery): Promise<Page<Subscription>> {
    const filtered = [...this.rows.values()]
      .filter((row) => query.userId === undefined || row.userId === query.userId)
      .filter((row) => query.status === undefined || row.status === query.status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const start = (query.page - 1) * query.pageSize;

    return {
      items: filtered.slice(start, start + query.pageSize).map((row) => Subscription.rehydrate(row)),
      page: query.page,
      pageSize: query.pageSize,
      total: filtered.length,
    };
  }
}
