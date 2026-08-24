/**
 * Fired (via `EventEmitter2`, event name `user.registered`) when a new user
 * successfully registers. No listener consumes it yet — out of scope for
 * this issue — it only needs to fire with the right payload.
 */
export class UserRegisteredEvent {
  readonly userId: number;
  readonly username: string;
  readonly email: string;

  /**
   * @param {number} userId - The newly created user's ID.
   * @param {string} username - The newly created user's username.
   * @param {string} email - The newly created user's email.
   */
  constructor(userId: number, username: string, email: string) {
    this.userId = userId;
    this.username = username;
    this.email = email;
  }
}
