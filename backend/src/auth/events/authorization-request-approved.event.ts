/**
 * Fired (via `EventEmitter2`, event name `authorization-request.approved`)
 * when the approver device authorizes a device-authorization request. No
 * listener consumes it yet — out of scope for this issue — it only needs to
 * fire with the right payload.
 */
export class AuthorizationRequestApprovedEvent {
  readonly uuid: string;
  readonly approvedByUserId: number;

  /**
   * @param {string} uuid - The authorization request's UUID.
   * @param {number} approvedByUserId - The ID of the user who approved the request.
   */
  constructor(uuid: string, approvedByUserId: number) {
    this.uuid = uuid;
    this.approvedByUserId = approvedByUserId;
  }
}
