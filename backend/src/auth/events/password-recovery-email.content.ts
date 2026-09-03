// The recovery email's subject line — a static constant (never interpolates
// user data, so there is no header-injection vector).
const SUBJECT = 'Reset your Kerghan password';

// Everything in the body before the reset link.
const BODY_PREFIX = [
  'Hi,',
  '',
  'We received a request to reset the password for your Kerghan account.',
  '',
  'Open this link to choose a new password:',
].join('\n');

// Everything in the body after the reset link.
const BODY_SUFFIX = [
  '',
  'This link can only be used once, and it expires a short time after it was',
  'requested. If it has already expired, request a new one from the sign-in page.',
  '',
  'If you didn\'t ask to reset your password, you can safely ignore this email —',
  'your password won\'t change.',
].join('\n');

/**
 * The shape returned by {@link buildPasswordRecoveryEmail} — a subset of the
 * `MailService#send` payload the listener spreads onto its `send({ to, ... })`
 * call. Text-only; `html` is deferred to a follow-up.
 */
export interface PasswordRecoveryEmailContent {
  subject: string;
  text: string;
}

/**
 * Composes the password-recovery email's subject and plain-text body. Pure —
 * the only dynamic part is `resetUrl`, placed on its own line so mail clients
 * linkify it. Mirrors the codebase's `buildJwtSignOptions` / `buildMailConfig`
 * pure-helper pattern so it is unit-testable without booting the app.
 * @param {string} resetUrl - The full recovery link
 *   (`${FRONTEND_BASE_URL}/#/recover-password?token=<token>`) built by
 *   `PasswordResetService#recover`; embedded verbatim in the body.
 * @returns {PasswordRecoveryEmailContent} The static subject and the
 *   plain-text body with `resetUrl` interpolated on its own line.
 */
export function buildPasswordRecoveryEmail(resetUrl: string): PasswordRecoveryEmailContent {
  return {
    subject: SUBJECT,
    text: `${BODY_PREFIX}\n${resetUrl}\n${BODY_SUFFIX}`,
  };
}
