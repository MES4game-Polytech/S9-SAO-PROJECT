import { describe, expect, it } from 'vitest';

import {
  InvalidSubscriptionTransition,
  UnknownSubscriptionPlan,
} from '../../src/contexts/subscription/domain/subscription.errors.js';
import { planDetails } from '../../src/contexts/subscription/domain/subscription-plan.js';
import { Subscription } from '../../src/contexts/subscription/domain/subscription.js';

const NOW = new Date('2026-01-15T10:00:00.000Z');
const USER_ID = '11111111-1111-4111-8111-111111111111';
const SUBSCRIPTION_ID = '22222222-2222-4222-8222-222222222222';

function createPending(): Subscription {
  return Subscription.create({
    id: SUBSCRIPTION_ID,
    userId: USER_ID,
    plan: 'PREMIUM_MONTHLY',
    now: NOW,
  });
}

function createActive(): Subscription {
  const subscription = createPending();
  subscription.activate('payment-1', NOW);
  return subscription;
}

describe('catalogue des plans', () => {
  it('expose le prix et la durée de chaque plan', () => {
    expect(planDetails('PREMIUM_MONTHLY')).toEqual({
      plan: 'PREMIUM_MONTHLY',
      priceCents: 499,
      currency: 'EUR',
      durationDays: 30,
    });
    expect(planDetails('PREMIUM_YEARLY').priceCents).toBe(4999);
  });

  it('rejette un plan inconnu', () => {
    expect(() => planDetails('GOLD')).toThrow(UnknownSubscriptionPlan);
  });
});

describe('Subscription.create', () => {
  it('crée un abonnement PENDING avec le prix du catalogue', () => {
    const subscription = createPending();

    expect(subscription.status).toBe('PENDING');
    expect(subscription.priceCents).toBe(499);
    expect(subscription.currency).toBe('EUR');
    expect(subscription.userId).toBe(USER_ID);
    expect(subscription.paymentId).toBeNull();
    expect(subscription.startsAt).toBeNull();
    expect(subscription.endsAt).toBeNull();
    expect(subscription.createdAt).toEqual(NOW);
  });

  it('génère un identifiant quand aucun n’est fourni', () => {
    const subscription = Subscription.create({ userId: USER_ID, plan: 'PREMIUM_YEARLY' });

    expect(subscription.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('refuse un plan inconnu', () => {
    expect(() =>
      Subscription.create({
        userId: USER_ID,
        plan: 'GOLD' as unknown as 'PREMIUM_MONTHLY',
      }),
    ).toThrow(UnknownSubscriptionPlan);
  });
});

describe('Subscription.activate', () => {
  it('passe PENDING -> ACTIVE et calcule la période', () => {
    const subscription = createActive();

    expect(subscription.status).toBe('ACTIVE');
    expect(subscription.isActive).toBe(true);
    expect(subscription.paymentId).toBe('payment-1');
    expect(subscription.startsAt).toEqual(NOW);
    expect(subscription.endsAt).toEqual(new Date('2026-02-14T10:00:00.000Z'));
  });

  it('refuse d’activer deux fois', () => {
    const subscription = createActive();

    expect(() => subscription.activate('payment-2', NOW)).toThrow(InvalidSubscriptionTransition);
  });

  it('refuse d’activer un abonnement échoué', () => {
    const subscription = createPending();
    subscription.fail('card_declined', NOW);

    expect(() => subscription.activate('payment-1', NOW)).toThrow(InvalidSubscriptionTransition);
  });
});

describe('Subscription.fail', () => {
  it('passe PENDING -> FAILED avec un motif', () => {
    const subscription = createPending();
    subscription.fail('card_declined', NOW);

    expect(subscription.status).toBe('FAILED');
    expect(subscription.failureReason).toBe('card_declined');
    expect(subscription.startsAt).toBeNull();
  });

  it('refuse d’échouer un abonnement déjà ACTIVE', () => {
    const subscription = createActive();

    expect(() => subscription.fail('card_declined', NOW)).toThrow(InvalidSubscriptionTransition);
  });
});

describe('Subscription.cancel', () => {
  it('passe ACTIVE -> CANCELLED et horodate', () => {
    const cancelDate = new Date('2026-02-01T12:00:00.000Z');
    const subscription = createActive();
    subscription.cancel(cancelDate);

    expect(subscription.status).toBe('CANCELLED');
    expect(subscription.cancelledAt).toEqual(cancelDate);
    expect(subscription.isActive).toBe(false);
  });

  it('refuse d’annuler un abonnement non ACTIVE', () => {
    const subscription = createPending();

    expect(() => subscription.cancel(NOW)).toThrow(InvalidSubscriptionTransition);
  });
});

describe('sérialisation', () => {
  it('rehydrate reconstruit l’entité à l’identique', () => {
    const original = createActive();
    const copy = Subscription.rehydrate(original.toProps());

    expect(copy.toProps()).toEqual(original.toProps());
  });

  it('toProps renvoie une copie, pas l’état interne', () => {
    const subscription = createPending();
    const props = subscription.toProps();

    (props as { status: string }).status = 'ACTIVE';

    expect(subscription.status).toBe('PENDING');
  });
});
