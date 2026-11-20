import { z } from 'zod';

try {
  process.loadEnvFile('.env');
} catch {
  // En conteneur, les variables sont injectées par Compose.
}

const Env = z.object({
  PORT: z.coerce.number().int().min(1).default(3000),
  SERVICE_NAME: z.string().default('subscription'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.url(),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ISSUER: z.string().default('polyshop-auth'),

  REDIS_URL: z.url().default('redis://localhost:6379'),
  EVENTS_STREAM: z.string().default('polyshop:events'),

  PAYMENT_URL: z.url(),
  PAYMENT_TIMEOUT_MS: z.coerce.number().int().min(100).default(2000),
  PAYMENT_RETRIES: z.coerce.number().int().min(0).max(5).default(2),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((origins) => origins.split(',').map((origin) => origin.trim())),
});

/** Un service mal configuré refuse de démarrer (12-factor, M10). */
export const config = Env.parse(process.env);
export type Config = z.infer<typeof Env>;
