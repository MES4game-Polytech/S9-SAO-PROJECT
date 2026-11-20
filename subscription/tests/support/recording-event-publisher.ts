import type { EventPublisher } from '../../src/contexts/subscription/domain/event-publisher.js';
import type { DomainEvent } from '../../src/shared/domain-event.js';

export class RecordingEventPublisher implements EventPublisher {
  readonly published: DomainEvent[] = [];

  async publish(event: DomainEvent): Promise<void> {
    this.published.push(event);
  }
}
