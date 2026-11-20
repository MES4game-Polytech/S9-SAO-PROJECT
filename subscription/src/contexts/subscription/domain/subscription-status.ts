/**
 * États du cycle de vie d'un abonnement.
 *
 */
export const SUBSCRIPTION_STATUSES = ['PENDING', 'ACTIVE', 'FAILED', 'CANCELLED'] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
