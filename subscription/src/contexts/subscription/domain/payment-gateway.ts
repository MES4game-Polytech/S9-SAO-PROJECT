import { DomainError } from '../../../shared/domain-error.js';

export interface PaymentRequest {
  /** Identifiant de l'objet central de l'hôte : ici, l'id de l'abonnement. */
  referenceId: string;
  userId: string;
  amountCents: number;
  currency: string;
}

/** Résultat synchrone renvoyé par `POST /api/v1/payments` (contrat v1). */
export type PaymentOutcome =
  | { status: 'SUCCEEDED'; paymentId: string }
  | { status: 'FAILED'; paymentId: string; reason: string };

/**
 * PORT vers le service payment (service sous contrat, appel synchrone).
 * L'implémentation s'occupe du timeout, des retries et de l'authentification.
 */
export interface PaymentGateway {
  pay(request: PaymentRequest): Promise<PaymentOutcome>;
}

/**
 * Panne technique du service payment (timeout après épuisement des retries).
 * Ce n'est pas une règle métier, mais elle emprunte l'enveloppe `DomainError`
 * pour que le filtre HTTP la rende en problem+json 503 sans cas particulier.
 * L'abonnement, lui, reste PENDING : le paiement n'a pas échoué, il est inconnu.
 */
export class PaymentUnavailable extends DomainError {
  constructor(referenceId: string) {
    super(
      `Payment service unavailable for reference ${referenceId}`,
      503,
      'PAYMENT_UNAVAILABLE',
      'Payment Service Unavailable',
    );
  }
}
