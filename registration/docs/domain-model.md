# Modèle métier et données — service registration
**Statut** : en cours de réalisation  
**Date** : 2026-11-21  
**Responsable** : Ambre

## 1. Rôle du service
`registration` gère les inscriptions aux événements de PolyBird (inscription, consultation, historique des événements passés, désinscription).
Il possède sa propre base PostgreSQL (`registrations`) et ne lit jamais la base d'un autre service.

Lors de l'inscription, il interroge le service `event` en HTTP pour vérifier l'existence de l'événement (et récupérer sa date de fin `endsAt`).  
Il publie ensuite les événements `registration.created` et `registration.deleted` sur Redis Streams.

## Règles métier
1. Un utilisateur peut être inscrit à plusieurs évènements à la fois.
2. Un utilisateur ne peut être inscrit **qu'une seule fois** à un même événement.
3. L'inscription est impossible si l'évènement n'existe pas ou s'il est déjà terminé.
4. L'utilisateur peut se désinscrire d'un évènement, seulement s'il était inscrit préalablement et que celui-ci n'est pas terminé. La ligne est alors supprimée physiquement, permettant une éventuelle réinscription.
5. Seul le propriétaire (ou un admin) peut s'inscrire (ou se désinscrire) à un évènement
6. Une fois l'événement terminé, l'inscription n'est plus supprimable et reste conservée en base comme historique de participation.
7. `userId` vient **exclusivement du JWT** (`sub`), jamais du corps de la requête.

## 3. Cycle de vie
Il n'y a pas de colonne `status` en base : la présence ou l'absence de la ligne ainsi que `endsAt` déterminent l'état de l'inscription.
```
                POST /api/v1/registrations
                           │
                           ▼
             ┌───────────────────────────┐
             │   INSCRIT (ligne en BDD)  │
             └───────────────────────────┘
               │                       │
      DELETE /:id                      │  temps qui passe
      (si endsAt > now)                │  (endsAt <= now)
               ▼                       ▼
      ┌─────────────────┐     ┌─────────────────────────┐
      │ SUPPRIMÉ (BDD)  │     │ HISTORIQUE (figé en BDD)│
      └─────────────────┘     └─────────────────────────┘
```


| État | Condition | Actions autorisées |
| --- | --- | --- |
| **Inscrit (à venir)** | Ligne présente en base et `endsAt > now` | Consultation (`GET`), Désinscription (`DELETE`) |
| **Historique (passé)** | Ligne présente en base et `endsAt <= now` | Consultation (`GET`) uniquement (`DELETE` → `409`) |
| **Non inscrit / Désinscrit** | Aucune ligne en base pour `(userId, eventId)` | Inscription (`POST`) si événement non terminé |

## 4. API
Préfixe : /api/v1/registrations. Toutes les routes sont protégées par JWT (Authorization: Bearer).

| Méthode | Route | Rôle | Codes |
| --- | --- | --- | --- |
| `POST` | `/` | Inscrit l'utilisateur (`sub`) à un événement | `201`, `400`, `401`, `404`, `409`, `503` |
| `GET` | `/` | Liste paginée de ses inscription (admin : tous) | `200`, `401` |
| `GET` | `/:id` | Détail d'une inscription (propriétaire ou admin) | `200`, `401`, `403`, `404` |
| `DELETE` | `/:id` | Désinscription (suppression physique si événement non terminé) | `204`, `401`, `403`, `404`, `409` |
| `GET` | `/health`, `/ready`, `/docs` | Exploitation / documentation | |

### Création
```http
POST /api/v1/registrations
Authorization: Bearer <jwt>
Content-Type: application/json

{ "eventId": "550e8400-e29b-41d4-a716-446655440000" }
```

`201 Created` + `Location: /api/v1/registrations/<id>` :
```json
{
  "id": "…",
  "userId": "…",
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "endsAt": "2026-12-15T22:00:00.000Z",
  "createdAt": "2026-11-21T14:00:00.000Z"
}
```

- 400 si le corps de requête est invalide (eventId manquant ou non-UUID) ;
- 404 si l'événement n'existe pas auprès du service event ;
- 409 si l'utilisateur est déjà inscrit à cet événement ou si l'événement est déjà terminé ;
- 503 problem+json si le service event est injoignable après timeout et retries.

### Liste
`GET /api/v1/registrations?page=1&pageSize=20&timeframe=upcoming&sort=-endsAt`

```json
{ "items": [], "page": 1, "pageSize": 20, "total": 0 }
```

- `page ≥ 1`, `pageSize` entre 1 et 100, défaut 20 ;
- `timeframe` optionnel : `upcoming` (endsAt > now), `past` (endsAt <= now), ou omis (tout) ;
- `eventId` optionnel : filtre les inscriptions d'un événement précis ;
- `userId` optionnel : réservé aux admins (un utilisateur normal ne voit que ses propres lignes) ;
- `sort` : createdAt / -createdAt (défaut), endsAt / -endsAt.

### Détail et désinscription

- `GET /api/v1/registrations/:id` : `404` si inconnu, `403` si appartient à un autre utilisateur (hors admin), `200` sinon.
- `DELETE /api/v1/registrations/:id` : `404` si inconnu, `403` si non propriétaire (hors admin), `409` si l'événement est déjà terminé, `204` No Content si supprimé.

### Erreurs
Format application/problem+json :
```json
{
  "type": "https://polybird/errors/already-registered",
  "title": "Already registered",
  "status": 409,
  "detail": "The user is already registered for this event.",
  "instance": "/api/v1/registrations",
  "requestId": "…"
}
```

Types d'erreurs métier exposés :
|Type|Code|Quand|
| --- | --- | --- |
|event-not-found|404|L'événement ciblé n'existe pas dans le service event|
|registration-not-found|404|L'identifiant d'inscription demandé n'existe pas|
|forbidden|403|Tentative d'accès ou de suppression par un tiers non-admin  
|already-registered|409|L'utilisateur est déjà inscrit à cet événement
|event-already-ended|409|Tentative d'inscription ou de désinscription sur un événement passé|
|upstream-unavailable|503|Le service event ne répond pas|

## 5. Événements (Redis Streams)
Stream : `EVENTS_STREAM` (défaut `polybird:events`).  
Enveloppe : `{ id, type, occurredAt, requestId?, payload }`, sérialisée dans les champs `type` et `event`.

| Sens | Type | Payload | Usage |
| --- | --- | --- | --- |
|Consomme|event.updated|{ eventId, endsAt }|met à jour `endsAt` sur les inscriptions concernées|
|Consomme|event.deleted|{ eventId }|supprime toutes les inscriptions liées à un événement supprimé|
|Publie|registration.created|{ registrationId, userId, eventId, createdAt }|`notification` confirme l'inscription, `event` met à jour son compteur|
|Publie|registration.deleted|{ registrationId, userId, eventId, deletedAt }|libère une place / met à jour le compteur|

- Consumer group : `registration` (`XGROUP CREATE ... MKSTREAM`).
- `XREADGROUP ... >`, `XACK` après traitement réussi, `XAUTOCLAIM` des orphelins.
- Les traitements consommateurs (event.updated et event.deleted) sont idempotents : si aucune inscription ne correspond à eventId, l'opération est un no-op et le message est acquitté.
- requestId est repris du x-request-id de la requête HTTP d'origine et propagé dans les événements publiés (registration.created, registration.deleted).

## 6. Base de données
Base PostgreSQL dédiée, schéma Prisma :
```prisma
model Registration {
    id String @id @default(uuid()) @db.Uuid
    eventId String @map("event_id") @db.Uuid
    userId String @map("user_id") @db.Uuid
    createdAt DateTime @map("created_at") @default(now()) @db.Timestamptz(6)
    endsAt DateTime @map("ends_at") @db.Timestamptz(6)

    @@unique([userId, eventId])
    @@index([userId, endsAt(sort: Desc)])
    @@index([eventId])
    @@map("registrations")
}
```

### Choix de modélisation
| Choix | Justification | Alternative écartée |
| --- | --- | --- |
|Suppression physique au `DELETE`|Pas besoin de tracer les annulations/réinscriptions ; libère directement la contrainte `@@unique`|Statut CANCELLED `(complexifie la réinscription)`|
|Stockage de `endsAt`|Permet de filtrer l'historique (`past` / `upcoming`) en SQL sans appeler `event` à chaque lecture|Appel HTTP systématique à `event` lors du `GET /registrations`|
|Pas de FK vers `auth` ou `event`|Une base par micro-service ; références logiques par UUID|FK inter-services (impossible sans base partagée)|

## 7. Flux nominal et cas d'erreur
### Flux 1 : Inscription
1. `POST /api/v1/registrations` avec `{ eventId }` et le Bearer token.
2. Le guard extrait `sub` (`userId`) et `role`.   
3. Le cas d'usage appelle `GET {EVENT_URL}/api/v1/events/:eventId` avec `x-request-id` (timeout + retry) :   
    - `404` → renvoie `404 EventNotFound` ;
    - injoignable / timeout → renvoie `503 ServiceUnavailable` ;   
    - `200` → vérifie que `endsAt > now` (sinon `409 EventAlreadyEnded`).
4. Insertion en base avec `endsAt = event.endsAt` (si violation `@@unique`, renvoie `409 AlreadyRegistered`).
5. Publication de registration.created sur Redis Streams et réponse 201 avec `Location`

### Flux 2 : Désinscription
1. `DELETE /api/v1/registrations/:id`
2. Le guard extrait `sub` (`userId`) et `role` depuis le Bearer token.   
3. Le cas d'usage recherche l'inscription par id (`404 registration-not-found` si absente).
4. Vérifie que `registration.userId === userId` ou `role === 'admin'` (`403 forbidden` sinon).   
5. Vérifie que `registration.endsAt > now` (`409 event-already-ended` sinon, l'inscription fait désormais partie de l'historique).
6. Suppression physique de la ligne en base.
7. Publication de `registration.deleted` sur Redis Streams (avec `requestId`) et réponse `204 No Content`.

**Limite connue** : entre l'écriture/suppression en base et la publication de l'événement Redis, un crash du processus peut perdre l'événement. Le pattern outbox corrigerait cela ; il est hors périmètre v1 et documenté comme amélioration possible.

## 8. Hors périmètre v1
- gestion des capacités maximales / listes d'attente (gérée côté event ou v2) ;
- inscription d'un tiers par un autre utilisateur (hors admin) ;
- outbox pattern.