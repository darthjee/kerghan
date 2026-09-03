// DI tokens for the outbound-email providers wired in `mail.module.ts`.
// Kept in their own file (rather than in `mail.module.ts`) so `mail.service.ts`
// can `@Inject(...)` them without importing the module — which would form an
// import cycle (module -> service -> module).

/**
 * Injection token for the frozen `MailConfig` resolved at boot.
 */
export const MAIL_CONFIG = 'MAIL_CONFIG';

/**
 * Injection token for the nodemailer `Transporter` (or `null` when email
 * is disabled).
 */
export const MAIL_TRANSPORT = 'MAIL_TRANSPORT';
