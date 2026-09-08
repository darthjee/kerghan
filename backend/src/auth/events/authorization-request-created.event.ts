/**
 * Fired (via `EventEmitter2`, event name `authorization-request.created`)
 * when a new device-authorization request is created. No listener consumes
 * it yet — out of scope for this issue — it only needs to fire with the
 * right payload.
 */
export class AuthorizationRequestCreatedEvent {
  readonly uuid: string;
  readonly username: string;
  readonly userId: number | null;

  /**
   * @param {string} uuid - The newly created authorization request's UUID.
   * @param {string} username - The username originally submitted, whether or
   *   not it resolved to a real user.
   * @param {number | null} userId - The resolved user's ID, or `null` when
   *   `username` did not resolve to a real user.
   */
  constructor(uuid: string, username: string, userId: number | null) {
    this.uuid = uuid;
    this.username = username;
    this.userId = userId;
  }
}
