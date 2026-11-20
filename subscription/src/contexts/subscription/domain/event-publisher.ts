import type { DomainEvent } from '../../../shared/domain-event.js';

/**
 * PORT de publication : le cas d'usage annonce un fait, l'infrastructure
 * choisit le transport (Redis Streams ici). Le domaine ignore XADD.
 */
export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}
