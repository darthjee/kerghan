import type { Transporter } from 'nodemailer';

/**
 * Message fields an {@link EmailMethod} delivers. Mirrors the subset of
 * `SendMailParams` (see `mail.service.ts`) that has already been resolved
 * to a concrete `from` address by the time delivery is attempted.
 */
export interface EmailMethodMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Outcome of a successful {@link EmailMethod.deliver} call.
 */
export interface EmailMethodResult {
  messageId?: string;
}

/**
 * Seam abstracting how a message is actually handed off (native SMTP today,
 * future providers later). `MailService.sendEmail` resolves one `EmailMethod`
 * by name from the registry `MailModule` provides and delegates delivery to
 * it once email is known to be enabled.
 */
export interface EmailMethod {
  /**
   * Delivers one message.
   * @param {EmailMethodMessage} message - The resolved from/to/subject/bodies.
   * @returns {Promise<EmailMethodResult>} Resolves with the provider's
   *   message id, when available.
   * @throws {Error} When the recipient is rejected or the underlying
   *   transport throws.
   */
  deliver(message: EmailMethodMessage): Promise<EmailMethodResult>;
}

/**
 * The only registered {@link EmailMethod} today: delivery through the
 * injected nodemailer `Transporter`. Preserves the exact accepted/rejected
 * handling that used to live inline in `MailService`.
 */
export class NativeEmailMethod implements EmailMethod {
  private readonly transporter: Transporter;

  /**
   * @param {Transporter} transporter - The boot-time nodemailer transporter.
   *   Only ever constructed with a non-null transporter — disabled email is
   *   short-circuited by `MailService.sendEmail` before any method runs.
   */
  constructor(transporter: Transporter) {
    this.transporter = transporter;
  }

  /**
   * @param {EmailMethodMessage} message - The resolved from/to/subject/bodies.
   * @returns {Promise<EmailMethodResult>} `{ messageId }` from the transport.
   * @throws {Error} When `info.rejected` is non-empty and `info.accepted` is
   *   empty (`mail: recipient rejected: <addrs>`), or when the transport throws.
   */
  async deliver(message: EmailMethodMessage): Promise<EmailMethodResult> {
    const info = await this.transporter.sendMail({
      from: message.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    if (info.rejected?.length && !info.accepted?.length) {
      throw new Error(`mail: recipient rejected: ${info.rejected.join(', ')}`);
    }

    return { messageId: info.messageId };
  }
}
