import { Module } from '@nestjs/common';
import { SubscriptionModule } from './contexts/subscription/subscription.module.js';

/**
 * Composition root racine du service.
 *
 * Équivalent Nest du `app.ts` du workbook : il assemble les modules du service
 * sans contenir de logique métier.
 */
@Module({
  imports: [SubscriptionModule],
})
export class AppModule {}
