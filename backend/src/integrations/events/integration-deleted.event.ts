/** The event name, emitted after an integration's row delete commits. */
export const INTEGRATION_DELETED = 'integration.deleted';

/**
 * Emitted (via `EventEmitter2#emitAsync`, awaited) by the Integrations module
 * once an integration's row delete committed, so the Repositories module
 * drops that integration's rows before `DELETE` answers `204` (see
 * `docs/agents/modules/integrations/github-service.md#deletion-hook`). Listeners catch
 * their own errors: a failure never fails the delete.
 */
export class IntegrationDeletedEvent {
  /**
   * @param {number} userId - The owner's id.
   * @param {number} integrationId - The deleted integration's internal `integrations.id`.
   */
  constructor(
    readonly userId: number,
    readonly integrationId: number,
  ) {}
}
