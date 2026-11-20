import type { AuthenticatedUser } from '../../../shared/authenticated-user.js';
import type { Page } from '../../../shared/page.js';
import type { SubscriptionStatus } from '../domain/subscription-status.js';
import type { Subscription } from '../domain/subscription.js';
import type { SubscriptionRepository } from '../domain/subscription.repository.js';

export interface ListSubscriptionsQuery {
  requester: AuthenticatedUser;
  status?: SubscriptionStatus;
  page: number;
  pageSize: number;
}

export class ListSubscriptions {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  execute(query: ListSubscriptionsQuery): Promise<Page<Subscription>> {
    return this.subscriptions.findPage({
      // Un utilisateur ne voit que ses abonnements ; un admin voit tout.
      userId: query.requester.role === 'admin' ? undefined : query.requester.userId,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}
