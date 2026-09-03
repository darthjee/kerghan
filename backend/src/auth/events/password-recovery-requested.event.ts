/**
 * Fired (via `EventEmitter2`, event name `password-recovery.requested`) when
 * a `POST /auth/recover.json` request matches an existing account and a
 * `PasswordResetToken` has been created for it. Consumed in-module by
 * `password-recovery-requested.listener.ts`, which builds the recovery-email
 * copy (via `password-recovery-email.content.ts`) and sends it to `email`
 * through `MailService` — best-effort, a send failure is logged and never
 * propagated back to the request. The plaintext `token` exists only in-flight
 * (in this payload and the reset link); only its hash is ever persisted.
 */
export class PasswordRecoveryRequestedEvent {
  readonly userId: number;
  readonly token: string;
  readonly resetUrl: string;
  readonly email: string;

  /**
   * @param {number} userId - The account the recovery token was issued for.
   * @param {string} token - The plaintext, one-time recovery token value —
   *   only its hash is persisted, this is the only place the plaintext
   *   exists outside the request that created it.
   * @param {string} resetUrl - The full recovery link
   *   (`${FRONTEND_BASE_URL}/#/recover-password?token=<token>`) to embed in
   *   the recovery email.
   * @param {string} email - The account's email address; the recovery email's
   *   recipient. Carried in the payload so the listener needs no DB lookup.
   */
  constructor(userId: number, token: string, resetUrl: string, email: string) {
    this.userId = userId;
    this.token = token;
    this.resetUrl = resetUrl;
    this.email = email;
  }
}
