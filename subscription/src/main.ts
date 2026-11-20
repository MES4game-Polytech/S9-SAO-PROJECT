import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { config } from './config.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors({ origin: config.CORS_ORIGINS });
  app.enableShutdownHooks();

  await app.listen(config.PORT);
  Logger.log(`${config.SERVICE_NAME} listening on http://localhost:${config.PORT}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
