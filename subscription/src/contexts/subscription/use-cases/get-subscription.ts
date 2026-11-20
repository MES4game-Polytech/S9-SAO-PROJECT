import type { AuthenticatedUser } from '../../../shared/authenticated-user.js';
import type { Subscription } from '../domain/subscription.js';
import { NotSubscriptionOwner, SubscriptionNotFound } from '../domain/subscription.errors.js';
import type { SubscriptionRepository } from '../domain/subscription.repository.js';

export interface GetSubscriptionQuery {
  subscriptionId: string;
  requester: AuthenticatedUser;
}

export class GetSubscription {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async execute(query: GetSubscriptionQuery): Promise<Subscription> {
    const subscription = await this.subscriptions.findById(query.subscriptionId);
    if (!subscription) throw new SubscriptionNotFound(query.subscriptionId);

    if (query.requester.role !== 'admin' && subscription.userId !== query.requester.userId) {
      throw new NotSubscriptionOwner(subscription.id, query.requester.userId);
    }

    return subscription;
  }
}
