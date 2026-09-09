/**
 * Fired (via `EventEmitter2`, event name `authorization-request.denied`)
 * when the approver device denies a device-authorization request. No
 * listener consumes it yet — out of scope for this issue — it only needs to
 * fire with the right payload.
 */
export class AuthorizationRequestDeniedEvent {
  readonly uuid: string;
  readonly deniedByUserId: number;

  /**
   * @param {string} uuid - The authorization request's UUID.
   * @param {number} deniedByUserId - The ID of the user who denied the request.
   */
  constructor(uuid: string, deniedByUserId: number) {
    this.uuid = uuid;
    this.deniedByUserId = deniedByUserId;
  }
}
