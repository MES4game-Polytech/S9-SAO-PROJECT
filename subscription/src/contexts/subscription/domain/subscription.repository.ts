import type { Page } from '../../../shared/page.js';
import type { Subscription } from './subscription.js';
import type { SubscriptionStatus } from './subscription-status.js';

/** Filtres et pagination d'une liste d'abonnements. */
export interface SubscriptionQuery {
  /** Absent = pas de filtre par propriétaire : réservé au rôle admin. */
  userId?: string;
  status?: SubscriptionStatus;
  page: number;
  pageSize: number;
}

/**
 * PORT : ce dont les cas d'usage ont besoin. L'infrastructure fournit
 * l'implémentation (Prisma en production, mémoire pour les tests).
 */
export interface SubscriptionRepository {
  create(subscription: Subscription): Promise<void>;

  /**
   * Écrit l'état de l'entité **uniquement si la ligne est encore** dans
   * `expectedStatus` (compare-and-set). Renvoie `true` si la transition a été
   * appliquée, `false` si un autre traitement l'avait déjà faite.
   *
   * C'est ce qui rend les consommateurs d'événements idempotents : rejouer un
   * `payment.succeeded` ne peut pas réactiver ni réécrire un abonnement.
   */
  save(subscription: Subscription, expectedStatus: SubscriptionStatus): Promise<boolean>;

  findById(id: string): Promise<Subscription | null>;

  /** Utilisé à la création : un seul abonnement PENDING ou ACTIVE par utilisateur. */
  findPendingOrActiveByUserId(userId: string): Promise<Subscription | null>;

  findPage(query: SubscriptionQuery): Promise<Page<Subscription>>;
}
