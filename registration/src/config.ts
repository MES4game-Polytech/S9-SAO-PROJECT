import { z } from 'zod';

try { process.loadEnvFile('.env'); } catch { /* en conteneur, variables injectées par Compose */ }

const Env = z.object({
  NODE_ENV: z.enum(['development','test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).default(3004),
  SERVICE_NAME: z.string().default('registration'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ISSUER: z.string().default('polybird-auth'),
  CORS_ORIGINS: z.string().default('http://localhost:5173').transform((s) => s.split(',').map((o) => o.trim())),
  EVENT_URL: z.url().default('https://localhost:3003'),
  EVENT_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  EVENT_RETRIES: z.coerce.number().int().default(2),
  REDIS_URL: z.url().default('redis://localhost:6379'),
  EVENTS_STREAM: z.string().default('polybird:events')
});

/** Un service mal configuré refuse de démarrer (12-factor, M10). */
export const config = Env.parse(process.env);