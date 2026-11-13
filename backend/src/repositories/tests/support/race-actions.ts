import { EventEmitter2 } from '@nestjs/event-emitter';
import type { RepositoriesDbHarness } from './repositories-db-harness.js';
import { USER_DELETED, UserDeletedEvent } from '../../../auth/events/user-deleted.event.js';
import { INTEGRATION_DELETED, IntegrationDeletedEvent, type IntegrationRef } from '../../../integrations/integrations-github.public.js';

/**
 * The Integrations delete as Repositories sees it: the integration leaves
 * both lists, then `integration.deleted` is emitted and awaited (what
 * `IntegrationLifecycleService#deleted` does once the row delete committed).
 * @param harness - The DB harness.
 * @param userId - The owner.
 * @param integrationId - The deleted integration.
 * @param remaining - The user's integrations after the delete (all usable).
 */
export async function deleteIntegrationNow(
  harness: RepositoriesDbHarness,
  userId: number,
  integrationId: number,
  remaining: IntegrationRef[],
): Promise<void> {
  harness.github.setUsable(userId, remaining).setIntegrations(userId, remaining);
  await harness.get(EventEmitter2).emitAsync(INTEGRATION_DELETED, new IntegrationDeletedEvent(userId, integrationId));
}

/**
 * The future Auth user deletion: the `auth_users` row delete commits, then
 * `user.deleted` is emitted and awaited.
 * @param harness - The DB harness.
 * @param userId - The deleted user.
 */
export async function deleteUserNow(harness: RepositoriesDbHarness, userId: number): Promise<void> {
  await harness.ds.query('DELETE FROM auth_users WHERE id = ?', [userId]);
  await harness.get(EventEmitter2).emitAsync(USER_DELETED, new UserDeletedEvent(userId));
}
