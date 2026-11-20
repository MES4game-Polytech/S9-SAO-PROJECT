import { DomainError } from '../../../shared/domain-error.js';
import type { SubscriptionStatus } from './subscription-status.js';

/** La ressource demandée n'existe pas (ou appartient à quelqu'un d'autre). */
export class SubscriptionNotFound extends DomainError {
  constructor(subscriptionId: string) {
    super(
      `Subscription with id ${subscriptionId} not found`,
      404,
      'SUBSCRIPTION_NOT_FOUND',
      'Subscription Not Found',
    );
  }
}

/**
 * Règle : un utilisateur ne peut avoir qu'un abonnement PENDING ou ACTIVE.
 * Levée à la création : il n'existe pas encore d'identifiant d'abonnement,
 * on identifie donc le conflit par l'utilisateur et l'état déjà en place.
 */
export class SubscriptionAlreadyPendingOrActive extends DomainError {
  constructor(userId: string, status: SubscriptionStatus) {
    super(
      `User with id ${userId} already has a subscription in status ${status}`,
      409,
      'SUBSCRIPTION_ALREADY_PENDING_OR_ACTIVE',
      'Subscription Already Pending or Active',
    );
  }
}

/** Un utilisateur ne peut lire ou annuler que ses propres abonnements (sauf admin). */
export class NotSubscriptionOwner extends DomainError {
  constructor(subscriptionId: string, userId: string) {
    super(
      `User with id ${userId} is not the owner of subscription with id ${subscriptionId}`,
      403,
      'NOT_SUBSCRIPTION_OWNER',
      'Not Subscription Owner',
    );
  }
}

/**
 * Transition d'état interdite (ex. cancel d'un PENDING, activate d'un FAILED).
 * 409 : la requête est valide mais entre en conflit avec l'état courant.
 */
export class InvalidSubscriptionTransition extends DomainError {
  constructor(subscriptionId: string, fromStatus: SubscriptionStatus, toStatus: SubscriptionStatus) {
    super(
      `Invalid transition from ${fromStatus} to ${toStatus} for subscription with id ${subscriptionId}`,
      409,
      'INVALID_SUBSCRIPTION_TRANSITION',
      'Invalid Subscription Transition',
    );
  }
}

/** Code de plan inconnu : la valeur ne figure pas dans PLAN_CATALOG. */
export class UnknownSubscriptionPlan extends DomainError {
  constructor(plan: string) {
    super(
      `Unknown subscription plan "${plan}"`,
      400,
      'UNKNOWN_SUBSCRIPTION_PLAN',
      'Unknown Subscription Plan',
    );
  }
}
