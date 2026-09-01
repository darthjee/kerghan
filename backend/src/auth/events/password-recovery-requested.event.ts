/**
 * Fired (via `EventEmitter2`, event name `password-recovery.requested`) when
 * a `POST /auth/recover.json` request matches an existing account and a
 * `PasswordResetToken` has been created for it. No listener consumes it
 * yet — out of scope for this issue (see #39) — it only needs to fire with
 * the right payload.
 */
export class PasswordRecoveryRequestedEvent {
  readonly userId: number;
  readonly token: string;
  readonly resetUrl: string;

  /**
   * @param {number} userId - The account the recovery token was issued for.
   * @param {string} token - The plaintext, one-time recovery token value —
   *   only its hash is persisted, this is the only place the plaintext
   *   exists outside the request that created it.
   * @param {string} resetUrl - The full recovery link
   *   (`${FRONTEND_BASE_URL}/#/recover-password?token=<token>`) to embed in
   *   the recovery email.
   */
  constructor(userId: number, token: string, resetUrl: string) {
    this.userId = userId;
    this.token = token;
    this.resetUrl = resetUrl;
  }
}
