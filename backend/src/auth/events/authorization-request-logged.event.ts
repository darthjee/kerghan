/**
 * Fired (via `EventEmitter2`, event name `authorization-request.logged`)
 * when a device-authorization request's winning poll mints a session
 * (the `approved → logged` transition). No listener consumes it yet — out
 * of scope for this issue — it only needs to fire with the right payload.
 */
export class AuthorizationRequestLoggedEvent {
  readonly uuid: string;
  readonly userId: number;

  /**
   * @param {string} uuid - The authorization request's UUID.
   * @param {number} userId - The ID of the user who was logged in.
   */
  constructor(uuid: string, userId: number) {
    this.uuid = uuid;
    this.userId = userId;
  }
}
