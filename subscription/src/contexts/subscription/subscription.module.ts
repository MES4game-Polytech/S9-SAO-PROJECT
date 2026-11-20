import { Module } from '@nestjs/common';

/**
 * Composition root du contexte `subscription`.
 *
 * Les contrôleurs, cas d'usage et adaptateurs (Prisma, payment, Redis)
 * seront câblés ici au fur et à mesure de l'implémentation.
 */
@Module({})
export class SubscriptionModule {}
