# Service registration — PolyBird
Gestion des inscriptions aux événements de PolyBird (inscription, consultation, historique des événements passés, désinscription).

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
- pino pour les logs structurés
- Docker

## Structure
```
registration/
├── src/
│   ├── main.ts                         # bootstrap Nest
│   ├── app.module.ts                   # composition root racine (équivalent Nest de app.ts)
│   ├── config.ts                       # variables d'environnement validées par Zod
│   ├── contexts/registration/
│   │   ├── registration.module.ts      # composition root du contexte
│   │   ├── domain/                      # entités, value objects, ports, erreurs — aucun import Nest/Prisma
│   │   ├── use-cases/                   # un cas d'usage par action
│   │   └── infrastructure/
│   │       ├── http/                    # contrôleurs et DTO HTTP
│   │       ├── persistence/             # adaptateur Prisma du port repository
|   |       └── event/                   # adaptateur HTTP vers le service event
│   ├── infrastructure/
│   │   ├── database/                    # schéma Prisma, migrations, PrismaService
│   │   ├── http/                        # guards, filtres problem+json, pipes Zod
│   │   └── messaging/                   # publisher et consumer Redis Streams
│   └── shared/                          # erreurs et types partagés
├── tests/
├── docs/
│   ├── domain-model.md                  # modèle métier et données figé
│   └── openapi.yaml                     # documentation HTTP
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
Le service écoute par défaut sur http://localhost:3004 (variable PORT).

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