import { defineConfig, env } from 'prisma/config'

try{process.loadEnvFile('.env'); } catch{}

export default defineConfig({
    schema : 'src/infrastructure/database/schema.prisma',
    migrations : {
        path : 'src/infrastructure/database/migrations',
        seed : 'tsx infrastructure/database/seed.ts',
    },
    datasource : {
        url : env('DATABASE_URL'),
    },
});