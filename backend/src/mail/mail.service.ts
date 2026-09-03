import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Transporter } from 'nodemailer';
import { MAIL_CONFIG, MAIL_TRANSPORT } from './mail.tokens.js';
import type { MailConfig } from './mail.config.js';

/**
 * Arguments accepted by {@link MailService.send}.
 */
export interface SendMailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}

/**
 * Outcome of {@link MailService.send}: `'skipped'` when email is disabled
 * (no transporter touched), `'sent'` with the transport `messageId`
 * otherwise.
 */
export interface SendMailResult {
  status: 'sent' | 'skipped';
  messageId?: string;
}

/**
 * Always-on wrapper around the injected nodemailer transporter. Holds no
 * env access of its own — the frozen {@link MailConfig} and the transporter
 * (or `null`, when email is disabled) are supplied by `MailModule`'s
 * providers.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly config: MailConfig;

  /**
   * @param {Transporter | null} transporter - The nodemailer transporter,
   *   or `null` when `config.enabled` is `false`.
   * @param {MailConfig} config - The frozen outbound-email config.
   */
  constructor(
    @Inject(MAIL_TRANSPORT) transporter: Transporter | null,
    @Inject(MAIL_CONFIG) config: MailConfig,
  ) {
    this.transporter = transporter;
    this.config = config;
  }

  /**
   * Sends one message through the configured transporter. When email is
   * disabled the call is a no-op that resolves to `{ status: 'skipped' }`.
   * A configured send that the transport rejects (or that throws) rejects
   * this promise — best-effort swallowing is the caller's responsibility.
   * @param {SendMailParams} params - Recipient, subject, bodies, optional `from`.
   * @returns {Promise<SendMailResult>} `{ status: 'skipped' }` when disabled,
   *   otherwise `{ status: 'sent', messageId }`.
   * @throws {Error} When `to` is missing, a header field contains a
   *   newline, the recipient is rejected, or the transport throws.
   */
  async send(params: SendMailParams): Promise<SendMailResult> {
    if (!this.config.enabled) {
      this.logger.debug(`email disabled; skipping message to ${params.to} subj=${params.subject}`);
      return { status: 'skipped' };
    }

    const from = params.from ?? this.config.from;

    this.#assertSendable(params, from);

    try {
      return await this.#deliver(params, from);
    } catch (err) {
      this.logger.error(`mail send failed to ${params.to} subj=${params.subject}: ${err}`);
      throw err;
    }
  }

  async #deliver(params: SendMailParams, from: string): Promise<SendMailResult> {
    const info = await this.transporter!.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });

    if (info.rejected?.length && !info.accepted?.length) {
      throw new Error(`mail: recipient rejected: ${info.rejected.join(', ')}`);
    }

    return { status: 'sent', messageId: info.messageId };
  }

  #assertSendable(params: SendMailParams, from: string): void {
    if (!params.to || !params.to.trim()) {
      throw new Error("mail: 'to' is required");
    }

    if (this.#hasNewline(params.to) || this.#hasNewline(params.subject) || this.#hasNewline(from)) {
      throw new Error('mail: header field contains a newline');
    }
  }

  #hasNewline(value: string): boolean {
    return /[\r\n]/.test(value);
  }
}
