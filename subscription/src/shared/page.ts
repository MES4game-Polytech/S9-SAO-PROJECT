/**
 * Page de résultats. La forme est alignée sur celle du contrat inter-groupes
 * (`PaymentPage`) pour que tous les services du projet paginent pareil.
 */
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
