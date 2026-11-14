/** The event name, emitted after a user's row delete commits. */
export const USER_DELETED = 'user.deleted';

/**
 * Emitted (via `EventEmitter2#emitAsync`, awaited) by the future user-deletion
 * path once the user row's delete committed, so the Repositories module drops
 * the user's rows from its five tables (see
 * `docs/agents/modules/repositories.md#user-deletion`). Auth has no deletion path
 * yet, so nothing emits it today; Repositories only listens. Listeners catch
 * their own errors: a failure never fails the deletion.
 */
export class UserDeletedEvent {
  /**
   * @param {number} userId - The deleted user's id.
   */
  constructor(readonly userId: number) {}
}
