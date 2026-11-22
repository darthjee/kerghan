import type { IntegrationRef } from '../../../integrations/integrations-github.public.js';

/**
 * An integration reference for the candidate and reader specs.
 * @param id - The integration id.
 * @param issuesWrite - The known write capability (default `writable`).
 * @returns The reference.
 */
export function integrationRef(id: number, issuesWrite: IntegrationRef['issuesWrite'] = 'writable'): IntegrationRef {
  return { id, uuid: `uuid-${id}`, label: `label-${id}`, type: 'pat', issuesWrite };
}
