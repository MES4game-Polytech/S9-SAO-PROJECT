import { randomUUID } from 'node:crypto';

import { InvalidSubscriptionTransition } from './subscription.errors.js';
import { planDetails, type SubscriptionPlan } from './subscription-plan.js';
import type { SubscriptionStatus } from './subscription-status.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** État complet d'un abonnement, tel qu'il est persisté. */
export interface SubscriptionProps {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  priceCents: number;
  currency: string;
  paymentId: string | null;
  failureReason: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Données minimales fournies par l'utilisateur : jamais de prix ni de statut. */
export interface CreateSubscriptionInput {
  userId: string;
  plan: SubscriptionPlan;
  id?: string;
  now?: Date;
}

/**
 * Entité du domaine : aucune dépendance à Nest, Prisma, HTTP ou Redis.
 *
 * Les transitions d'état sont des méthodes explicites (`activate`, `fail`,
 * `cancel`) qui refusent tout chemin non prévu par le modèle. Le prix et la
 * durée sont lus dans le catalogue, pas fournis par l'appelant.
 */
export class Subscription {
  private constructor(private readonly props: SubscriptionProps) {}

  /** Crée un abonnement en attente de paiement. */
  static create(input: CreateSubscriptionInput): Subscription {
    const { priceCents, currency } = planDetails(input.plan);
    const now = input.now ?? new Date();

    return new Subscription({
      id: input.id ?? randomUUID(),
      userId: input.userId,
      plan: input.plan,
      status: 'PENDING',
      priceCents,
      currency,
      paymentId: null,
      failureReason: null,
      startsAt: null,
      endsAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Reconstruit l'entité depuis la persistance, sans rejouer les invariants. */
  static rehydrate(props: SubscriptionProps): Subscription {
    return new Subscription({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get plan(): SubscriptionPlan {
    return this.props.plan;
  }

  get status(): SubscriptionStatus {
    return this.props.status;
  }

  get priceCents(): number {
    return this.props.priceCents;
  }

  get currency(): string {
    return this.props.currency;
  }

  get paymentId(): string | null {
    return this.props.paymentId;
  }

  get failureReason(): string | null {
    return this.props.failureReason;
  }

  get startsAt(): Date | null {
    return this.props.startsAt;
  }

  get endsAt(): Date | null {
    return this.props.endsAt;
  }

  get cancelledAt(): Date | null {
    return this.props.cancelledAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Vrai si l'abonnement est ACTIVE. En v1 `endsAt` n'est qu'informatif :
   * il n'y a pas de job d'expiration, donc pas de règle temporelle ici.
   */
  get isActive(): boolean {
    return this.props.status === 'ACTIVE';
  }

  /** PENDING -> ACTIVE : le paiement a réussi. */
  activate(paymentId: string, now: Date = new Date()): void {
    if (this.props.status !== 'PENDING') {
      throw new InvalidSubscriptionTransition(this.props.id, this.props.status, 'ACTIVE');
    }

    const { durationDays } = planDetails(this.props.plan);

    this.props.status = 'ACTIVE';
    this.props.paymentId = paymentId;
    this.props.startsAt = now;
    this.props.endsAt = addDays(now, durationDays);
    this.props.updatedAt = now;
  }

  /** PENDING -> FAILED : le paiement a échoué explicitement. */
  fail(reason: string, now: Date = new Date()): void {
    if (this.props.status !== 'PENDING') {
      throw new InvalidSubscriptionTransition(this.props.id, this.props.status, 'FAILED');
    }

    this.props.status = 'FAILED';
    this.props.failureReason = reason;
    this.props.updatedAt = now;
  }

  /** ACTIVE -> CANCELLED : résiliation à la demande du titulaire. */
  cancel(now: Date = new Date()): void {
    if (this.props.status !== 'ACTIVE') {
      throw new InvalidSubscriptionTransition(this.props.id, this.props.status, 'CANCELLED');
    }

    this.props.status = 'CANCELLED';
    this.props.cancelledAt = now;
    this.props.updatedAt = now;
  }

  /** Copie défensive : l'extérieur ne peut pas muter l'état interne. */
  toProps(): Readonly<SubscriptionProps> {
    return { ...this.props };
  }
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_IN_MS);
}
