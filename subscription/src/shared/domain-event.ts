/**
 * Enveloppe commune des événements (contrat inter-groupes v1, EVENTS.md).
 * Le transport ajoute le champ `type` à côté du JSON de cette enveloppe.
 */
export interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  occurredAt: string;
  requestId?: string;
  payload: T;
}
