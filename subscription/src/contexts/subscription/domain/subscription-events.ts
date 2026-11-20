import { randomUUID } from 'node:crypto';

import type { DomainEvent } from '../../../shared/domain-event.js';
import type { SubscriptionPlan } from './subscription-plan.js';
import type { Subscription } from './subscription.js';

/** Faits passés que ce service publie (voir docs/domain-model.md). */
export const SUBSCRIPTION_EVENT_TYPES = {
  ACTIVATED: 'subscription.activated',
  CANCELLED: 'subscription.cancelled',
} as const;

export type SubscriptionEventType =
  (typeof SUBSCRIPTION_EVENT_TYPES)[keyof typeof SUBSCRIPTION_EVENT_TYPES];

export interface SubscriptionActivatedPayload {
  subscriptionId: string;
  userId: string;
  plan: SubscriptionPlan;
  startsAt: string;
  endsAt: string;
}

export interface SubscriptionCancelledPayload {
  subscriptionId: string;
  userId: string;
  cancelledAt: string;
}

export interface EventOptions {
  requestId?: string;
  now?: Date;
}

export function subscriptionActivatedEvent(
  subscription: Subscription,
  options: EventOptions = {},
): DomainEvent<SubscriptionActivatedPayload> {
  const { startsAt, endsAt } = subscription;

  // Invariant, pas règle métier : seul `activate()` écrit ces deux dates.
  if (!startsAt || !endsAt) {
    throw new Error(
      `Subscription ${subscription.id} has no activation period: cannot build ${SUBSCRIPTION_EVENT_TYPES.ACTIVATED}`,
    );
  }

  return {
    id: randomUUID(),
    type: SUBSCRIPTION_EVENT_TYPES.ACTIVATED,
    occurredAt: occurredAt(options),
    ...requestIdField(options),
    payload: {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      plan: subscription.plan,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    },
  };
}

export function subscriptionCancelledEvent(
  subscription: Subscription,
  options: EventOptions = {},
): DomainEvent<SubscriptionCancelledPayload> {
  const { cancelledAt } = subscription;

  if (!cancelledAt) {
    throw new Error(
      `Subscription ${subscription.id} has no cancellation date: cannot build ${SUBSCRIPTION_EVENT_TYPES.CANCELLED}`,
    );
  }

  return {
    id: randomUUID(),
    type: SUBSCRIPTION_EVENT_TYPES.CANCELLED,
    occurredAt: occurredAt(options),
    ...requestIdField(options),
    payload: {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      cancelledAt: cancelledAt.toISOString(),
    },
  };
}

function occurredAt(options: EventOptions): string {
  return (options.now ?? new Date()).toISOString();
}

/** `requestId` est optionnel : on ne l'écrit pas plutôt que d'écrire `undefined`. */
function requestIdField(options: EventOptions): { requestId?: string } {
  return options.requestId ? { requestId: options.requestId } : {};
}
