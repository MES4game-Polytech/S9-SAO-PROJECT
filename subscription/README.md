# Service `subscription` — PolyBird

Service central de PolyBird : gestion des abonnements premium (création, paiement, activation,
consultation, annulation).

## Statut

Squelette NestJS uniquement : structure, configuration, schéma Prisma et briques de base.
Aucune route HTTP ni logique métier n'est encore implémentée.

## Stack

- NestJS 12 (ESM)
- TypeScript strict
- Prisma 7 + PostgreSQL
- Redis Streams pour les événements
- Zod pour la configuration et la validation
- Vitest + Supertest pour les tests
- pino pour les logs structurés (à brancher)
- Docker

## Structure

```
subscription/
├── src/
│   ├── main.ts                         # bootstrap Nest
│   ├── app.module.ts                   # composition root racine (équivalent Nest de app.ts)
│   ├── config.ts                       # variables d'environnement validées par Zod
│   ├── contexts/subscription/
│   │   ├── subscription.module.ts      # composition root du contexte
│   │   ├── domain/                      # entités, value objects, ports, erreurs — aucun import Nest/Prisma
│   │   ├── use-cases/                   # un cas d'usage par action
│   │   └── infrastructure/
│   │       ├── http/                    # contrôleurs et DTO HTTP
│   │       ├── persistence/             # adaptateur Prisma du port repository
│   │       └── payment/                 # adaptateur HTTP du port payment
│   ├── infrastructure/
│   │   ├── database/                    # schéma Prisma, migrations, PrismaService
│   │   ├── http/                        # guards, filtres problem+json, pipes Zod
│   │   └── messaging/                   # publisher et consumer Redis Streams
│   └── shared/                          # erreurs et types partagés
├── tests/
├── docs/
│   ├── domain-model.md                  # modèle métier et données figé
│   └── openapi.yaml                     # documentation HTTP (à compléter)
├── prisma.config.ts
├── vitest.config.ts
├── Dockerfile
├── eslint.config.js
├── tsconfig.json
└── package.json
```

## Démarrage local

```bash
cp .env.example .env
npm install
npm run db:generate
npm run dev
```

Le service écoute par défaut sur `http://localhost:3005` (variable `PORT`).

## Commandes utiles

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Documentation

- [Modèle métier et données](docs/domain-model.md)
- [OpenAPI](docs/openapi.yaml)
