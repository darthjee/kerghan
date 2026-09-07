import { Inject, Injectable } from '@nestjs/common';
import type { MailConfig } from './mail.config.js';
import type { EmailMethod } from './mail.method.js';
import { MAIL_CONFIG, MAIL_METHODS } from './mail.tokens.js';
import { LoggerService } from '../core/logger.service.js';

/**
 * Arguments accepted by {@link MailService.sendEmail}. `method`, when
 * given, overrides the configured default `EmailMethod` for this one call.
 */
export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  html?: string;
  from?: string;
  method?: string;
}

/**
 * Outcome of {@link MailService.sendEmail}: `'skipped'` when email is
 * disabled (no method touched), `'sent'` with the delivering method's
 * `messageId` otherwise. `method` names whichever `EmailMethod` was
 * resolved, on both outcomes.
 */
export interface SendEmailResult {
  status: 'sent' | 'skipped';
  method: string;
  messageId?: string;
}

/**
 * Always-on outbound-email facade. Holds no env access of its own — the
 * frozen {@link MailConfig} and the `EmailMethod` registry (keyed by
 * method name) are supplied by `MailModule`'s providers. Delivery itself is
 * delegated to the resolved `EmailMethod`; this class owns only method
 * resolution, disabled short-circuiting, and the send-time guards.
 */
@Injectable()
export class MailService {
  private readonly logger: LoggerService;
  private readonly config: MailConfig;
  private readonly methods: Record<string, EmailMethod>;

  /**
   * @param {MailConfig} config - The frozen outbound-email config.
   * @param {Record<string, EmailMethod>} methods - The `EmailMethod`
   *   registry keyed by method name, built by `MailModule`.
   * @param {LoggerService} logger - The injected Core logger.
   */
  constructor(
    @Inject(MAIL_CONFIG) config: MailConfig,
    @Inject(MAIL_METHODS) methods: Record<string, EmailMethod>,
      logger: LoggerService,
  ) {
    this.config = config;
    this.methods = methods;
    this.logger = logger;
  }

  /**
   * Sends one message through the resolved `EmailMethod`. `method` resolves
   * to `params.method ?? config.method` and is validated against the
   * registry before anything else — an unknown method always throws, even
   * when email is disabled. When email is disabled the call is otherwise a
   * no-op that resolves to `{ status: 'skipped', method }`. A configured
   * send that the method rejects (or that throws) rejects this promise —
   * best-effort swallowing is the caller's responsibility.
   * @param {SendEmailParams} params - Recipient, subject, body, optional
   *   `html`/`from`/`method`.
   * @returns {Promise<SendEmailResult>} `{ status: 'skipped', method }`
   *   when disabled, otherwise `{ status: 'sent', method, messageId }`.
   * @throws {Error} When `method` is not a registered `EmailMethod`, `to`
   *   is missing, a header field contains a newline, the recipient is
   *   rejected, or the method throws.
   */
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const method = params.method ?? this.config.method;

    this.#assertKnownMethod(method);

    if (!this.config.enabled) {
      this.logger.debug('email disabled; skipping send', {
        context: 'MailService',
        to: params.to,
        subject: params.subject,
        method,
      });
      return { status: 'skipped', method };
    }

    const from = params.from ?? this.config.from;

    this.#assertSendable(params, from);

    try {
      return await this.#deliver(params, from, method);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error('mail send failed', {
        context: 'MailService',
        to: params.to,
        subject: params.subject,
        method,
        reason,
      });
      throw err;
    }
  }

  async #deliver(params: SendEmailParams, from: string, method: string): Promise<SendEmailResult> {
    const { messageId } = await this.methods[method].deliver({
      from,
      to: params.to,
      subject: params.subject,
      text: params.body,
      html: params.html,
    });

    return { status: 'sent', method, messageId };
  }

  #assertKnownMethod(method: string): void {
    if (!this.methods[method]) {
      throw new Error(`mail: unknown method: ${method}`);
    }
  }

  #assertSendable(params: SendEmailParams, from: string): void {
    if (!params.to.trim()) {
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
