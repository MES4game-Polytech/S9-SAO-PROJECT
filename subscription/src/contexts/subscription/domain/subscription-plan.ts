import { UnknownSubscriptionPlan } from './subscription.errors.js';

export const SUBSCRIPTION_PLANS = ['PREMIUM_MONTHLY', 'PREMIUM_YEARLY'] as const;

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export interface PlanDetails {
  readonly plan: SubscriptionPlan;
  readonly priceCents: number;
  readonly currency: string;
  readonly durationDays: number;
}

/**
 * Catalogue des offres : c'est la source de vérité du prix et de la durée.
 */
export const PLAN_CATALOG: Readonly<Record<SubscriptionPlan, PlanDetails>> = {
  PREMIUM_MONTHLY: {
    plan: 'PREMIUM_MONTHLY',
    priceCents: 499,
    currency: 'EUR',
    durationDays: 30,
  },
  PREMIUM_YEARLY: {
    plan: 'PREMIUM_YEARLY',
    priceCents: 4999,
    currency: 'EUR',
    durationDays: 365,
  },
};

export function isSubscriptionPlan(value: string): value is SubscriptionPlan {
  return (SUBSCRIPTION_PLANS as readonly string[]).includes(value);
}

/**
 * `plan` est typé `string` exprès : la valeur vient de l'extérieur
 * (corps HTTP, event), donc elle doit être validée à l'exécution.
 */
export function planDetails(plan: string): PlanDetails {
  if (!isSubscriptionPlan(plan)) {
    throw new UnknownSubscriptionPlan(plan);
  }

  return PLAN_CATALOG[plan];
}
