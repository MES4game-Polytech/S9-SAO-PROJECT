# Modèle métier et données — service `subscription`

**Statut** : figé pour la v1
**Date** : 2026-11-08
**Responsable** : Adam (service central PolyBird)

## 1. Rôle du service

`subscription` est le service central de PolyBird. Il gère l'abonnement premium d'un utilisateur :
création, paiement, activation, consultation et annulation. Il possède sa propre base PostgreSQL
(`subscriptions`) et ne lit jamais la base d'un autre service.

Le premium donne le droit de créer des événements et de publier des posts sans limite de caractères.
`post` et `event` ne lisent pas la base `subscriptions` : ils reçoivent `subscription.activated` et
`subscription.cancelled` et mettent à jour leur propre copie des droits.

## 2. Règles métier

1. Un utilisateur a **au plus un abonnement `PENDING` ou `ACTIVE`** à la fois.
2. `userId` vient **exclusivement du JWT** (`sub`), jamais du corps de la requête.
3. Le prix et la durée sont calculés **côté serveur** à partir du plan ; le client ne les envoie jamais.
4. Un abonnement naît `PENDING`. Il devient `ACTIVE` si le paiement réussit, `FAILED` si le paiement
   échoue explicitement.
5. Un paiement dont l'issue est **inconnue** (timeout, service injoignable après retries) laisse
   l'abonnement `PENDING` : l'événement `payment.succeeded` / `payment.failed` tranchera.
6. Seul un abonnement `ACTIVE` peut être annulé. L'annulation est immédiate.
7. Seul le propriétaire (ou un admin) peut lire ou annuler un abonnement.
8. Le traitement des événements est **idempotent** : une transition déjà effectuée est un no-op.

## 3. États et transitions

```
                 POST /subscriptions
                          │
                          ▼
                    ┌──────────┐
                    │ PENDING  │
                    └──────────┘
                     │        │
        paiement OK  │        │  paiement FAILED explicite
                     ▼        ▼
               ┌──────────┐  ┌────────┐
               │  ACTIVE  │  │ FAILED │  (terminal)
               └──────────┘  └────────┘
                     │
                     │ POST /:id/cancel
                     ▼
               ┌───────────┐
               │ CANCELLED │  (terminal)
               └───────────┘
```

| Depuis | Déclencheur | Vers |
| --- | --- | --- |
| ∅ | `POST /subscriptions` | `PENDING` |
| `PENDING` | paiement `SUCCEEDED` (réponse sync ou `payment.succeeded`) | `ACTIVE` |
| `PENDING` | paiement `FAILED` explicite (réponse sync ou `payment.failed`) | `FAILED` |
| `PENDING` | paiement injoignable après timeout + retries | reste `PENDING` |
| `ACTIVE` | `POST /:id/cancel` | `CANCELLED` |

États terminaux : `FAILED`, `CANCELLED`.

**Idempotence par état** : les transitions sont appliquées par un `UPDATE ... WHERE status = 'PENDING'`
conditionnel. Si la ligne a déjà changé, aucun événement n'est republié. Pas de table
`processed_events` en v1.

## 4. Formules

| Plan | Durée | Prix |
| --- | --- | --- |
| `PREMIUM_MONTHLY` | 30 jours | 499 cents (4,99 €) |
| `PREMIUM_YEARLY` | 365 jours | 4 999 cents (49,99 €) |

Le catalogue est un objet du domaine, **en code** : pas de table `plans`, pas d'administration de
tarifs. Le prix est recopié dans l'abonnement au moment de la création (`priceCents`) pour que
l'historique ne change pas si les tarifs évoluent.

`endsAt` est renseigné à l'activation (`startsAt + durée`) mais **la v1 n'applique pas d'expiration
automatique** : un abonnement `ACTIVE` le reste jusqu'à annulation. `endsAt` est une information pour
le front et pour les consommateurs.

## 5. API

Préfixe : `/api/v1/subscriptions`. Toutes les routes sont protégées par JWT (`Authorization: Bearer`).

| Méthode | Route | Rôle | Codes |
| --- | --- | --- | --- |
| `POST` | `/` | Crée un abonnement, appelle `payment`, retourne l'état final | `201`, `400`, `401`, `409`, `502`, `503` |
| `GET` | `/` | Liste paginée de ses abonnements (admin : tous) | `200`, `401` |
| `GET` | `/:id` | Détail ; propriétaire ou admin | `200`, `401`, `403`, `404` |
| `POST` | `/:id/cancel` | `ACTIVE → CANCELLED` | `200`, `401`, `403`, `404`, `409` |
| `GET` | `/me/current` *(optionnel)* | Abonnement actif courant | `200`, `404` |
| `GET` | `/health`, `/ready`, `/docs` | Exploitation / documentation | |

Pas de `PUT`/`PATCH` générique : les changements d'état passent par des actions explicites.

### Création

```http
POST /api/v1/subscriptions
Authorization: Bearer <jwt>
Content-Type: application/json

{ "plan": "PREMIUM_MONTHLY" }
```

`201 Created` + `Location: /api/v1/subscriptions/<id>` :

```json
{
  "id": "…",
  "userId": "…",
  "plan": "PREMIUM_MONTHLY",
  "status": "ACTIVE",
  "priceCents": 499,
  "currency": "EUR",
  "paymentId": "…",
  "failureReason": null,
  "startsAt": "2026-11-08T10:00:00.000Z",
  "endsAt": "2026-12-08T10:00:00.000Z",
  "cancelledAt": null,
  "createdAt": "2026-11-08T10:00:00.000Z"
}
```

Un paiement refusé renvoie aussi `201` (la ressource existe, dans l'état `FAILED`) avec
`failureReason`. Un paiement injoignable renvoie `503 problem+json` et laisse la ressource `PENDING`.

### Liste

`GET /api/v1/subscriptions?page=1&pageSize=20&status=ACTIVE&sort=-createdAt`

```json
{ "items": [], "page": 1, "pageSize": 20, "total": 0 }
```

- `page ≥ 1`, `pageSize` entre 1 et 100, défaut 20 ;
- `status` optionnel ;
- `sort` : `createdAt` / `-createdAt` (défaut), `startsAt` / `-startsAt` ;
- un admin peut filtrer avec `userId` ; un utilisateur normal ne voit que ses lignes.

### Détail et propriété

`GET /api/v1/subscriptions/:id` : `404` si inconnu, `403` si la ressource appartient à quelqu'un
d'autre, `200` sinon. Même règle pour l'annulation.

### Annulation

`POST /api/v1/subscriptions/:id/cancel` : `ACTIVE → CANCELLED`, `200` avec la ressource à jour.
`409` si l'abonnement n'est pas `ACTIVE`.

### Erreurs

Format `application/problem+json` :

```json
{
  "type": "https://polybird/errors/subscription-already-active",
  "title": "Subscription already active",
  "status": 409,
  "detail": "The user already has a pending or active subscription.",
  "instance": "/api/v1/subscriptions",
  "requestId": "…"
}
```

## 6. Événements (Redis Streams)

Stream : `EVENTS_STREAM` (défaut `polyshop:events`). Enveloppe :
`{ id, type, occurredAt, requestId?, payload }`, sérialisée dans les champs `type` et `event`.

| Sens | Type | Payload | Usage |
| --- | --- | --- | --- |
| Consomme | `payment.succeeded` | `{ paymentId, referenceId, userId, amountCents }` | active un `PENDING` si la réponse sync a été perdue |
| Consomme | `payment.failed` | `{ paymentId, referenceId, userId, amountCents, reason }` | passe un `PENDING` en `FAILED` |
| Publie | `subscription.activated` | `{ subscriptionId, userId, plan, startsAt, endsAt }` | `post` et `event` accordent les droits premium |
| Publie | `subscription.cancelled` | `{ subscriptionId, userId, cancelledAt }` | `post` et `event` révoquent les droits |
| Publie *(optionnel)* | `subscription.payment_failed` | `{ subscriptionId, userId, reason }` | `notification` informe l'utilisateur |

- Consumer group : `subscription` (`XGROUP CREATE ... MKSTREAM`).
- `XREADGROUP ... >`, `XACK` après traitement réussi, `XAUTOCLAIM` des orphelins.
- Un événement `payment.*` n'est pris en compte que si `referenceId` correspond à un abonnement
  existant **et** si `userId` correspond.
- `requestId` est repris du `x-request-id` de la requête d'origine et propagé dans les événements
  publiés.

## 7. Base de données

Base PostgreSQL dédiée, schéma Prisma :

```prisma
enum SubscriptionPlan {
  PREMIUM_MONTHLY
  PREMIUM_YEARLY
}

enum SubscriptionStatus {
  PENDING
  ACTIVE
  FAILED
  CANCELLED
}

model Subscription {
  id            String             @id @default(uuid()) @db.Uuid
  userId        String             @map("user_id") @db.Uuid
  plan          SubscriptionPlan
  status        SubscriptionStatus @default(PENDING)
  priceCents    Int                @map("price_cents")
  currency      String             @default("EUR") @db.Char(3)
  paymentId     String?            @map("payment_id")
  failureReason String?            @map("failure_reason")
  startsAt      DateTime?          @map("starts_at") @db.Timestamptz(6)
  endsAt        DateTime?          @map("ends_at") @db.Timestamptz(6)
  cancelledAt   DateTime?          @map("cancelled_at") @db.Timestamptz(6)
  createdAt     DateTime           @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt     DateTime           @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@index([userId, createdAt(sort: Desc)])
  @@index([userId, status])
  @@map("subscriptions")
}
```

### Choix de modélisation

| Choix | Justification | Alternative écartée |
| --- | --- | --- |
| Une seule table `subscriptions` | Le agrégat est l'abonnement ; pas de sous-entité nécessaire en v1 | Table `payment_attempts` (utile seulement si retry/renouvellement) |
| Catalogue de plans en code | Tarifs statiques, aucun besoin d'administration | Table `plans` administrable |
| Pas de FK vers `auth.users` | Une base par service ; `userId` est une référence logique | FK inter-services (impossible sans base partagée) |
| Prix recopié dans la ligne | Historique stable si les tarifs changent | Jointure avec un catalogue externe |
| Idempotence par transition conditionnelle | Pas de table supplémentaire, suffisant pour les effets de bord actuels | Table `processed_events` |
| Index partiel `(user_id) WHERE status IN ('PENDING','ACTIVE')` | Garantie SQL de l'invariant « un seul abonnement en cours » | Vérification applicative seule (v1, suffisante pour le projet) |

L'index partiel ne s'exprime pas dans le schéma Prisma ; il peut être ajouté dans une migration SQL
manuelle. En v1, l'invariant est vérifié dans le cas d'usage de création.

## 8. Flux nominal et cas d'erreur

1. `POST /subscriptions` avec `{ plan }` et le Bearer token.
2. Le guard extrait `sub` et `role`.
3. Le cas d'usage vérifie qu'il n'existe pas déjà un `PENDING`/`ACTIVE`, calcule le prix et la durée,
   insère un `PENDING`.
4. Appel `POST {PAYMENT_URL}/api/v1/payments` avec
   `{ referenceId: subscription.id, amountCents, currency: "EUR" }`, le token utilisateur et
   `x-request-id`, avec timeout et retry.
5. Selon la réponse :
   - `SUCCEEDED` → `PENDING → ACTIVE` (conditionnel), enregistre `paymentId`, `startsAt`, `endsAt`,
     publie `subscription.activated` ;
   - `FAILED` → `PENDING → FAILED`, enregistre `paymentId` et `reason` ;
   - injoignable / timeout après retries → laisse `PENDING`, retourne `503` ; le consommateur
     `payment.succeeded` / `payment.failed` résoudra l'issue si l'événement arrive.
6. Réponse `201` avec `Location` et le corps de l'abonnement.

**Limite connue** : entre la mise à jour locale et la publication de l'événement, un crash peut
perdre l'événement. Le pattern *outbox* corrigerait cela ; il est hors périmètre v1 et documenté
comme amélioration possible.

## 9. Hors périmètre v1

- expiration automatique et renouvellement ;
- remboursement ;
- plusieurs abonnements simultanés ;
- retry d'un paiement échoué (on recrée un abonnement) ;
- outbox pattern ;
- endpoint d'agrégat `/me/current` (optionnel, à ajouter si le front en a besoin).

## 10. Prochaine étape

Élaborer la structure du service NestJS conforme à la convention du workbook :
`src/contexts/subscription/{domain,use-cases,infrastructure}`,
`src/infrastructure/{database,http,messaging}`, `src/main.ts`, `src/app.module.ts`, `src/config.ts`,
tests, Prisma, Dockerfile.
