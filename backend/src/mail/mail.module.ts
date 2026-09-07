import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { buildMailConfig, type MailConfig } from './mail.config.js';
import { NativeEmailMethod, type EmailMethod } from './mail.method.js';
import { MailService } from './mail.service.js';
import { MAIL_CONFIG, MAIL_METHODS, MAIL_TRANSPORT } from './mail.tokens.js';
import { LoggerService } from '../core/logger.service.js';

export { MAIL_CONFIG, MAIL_METHODS, MAIL_TRANSPORT } from './mail.tokens.js';

/**
 * Builds the boot-time transporter from the resolved config. Returns
 * `null` when outbound email is disabled; otherwise builds the transporter.
 * Uses the injected Core logger to emit one line about the resulting state,
 * carrying the host only — never the whole config, which holds the SMTP
 * password.
 * @param {MailConfig} config - The frozen config from `buildMailConfig`.
 * @param {LoggerService} logger - The injected Core logger.
 * @returns {Transporter | null} The transporter, or `null` when disabled.
 */
function createMailTransport(config: MailConfig, logger: LoggerService): Transporter | null {
  if (!config.enabled || !config.transport) {
    logger.info('outbound email disabled', { context: 'MailModule' });
    return null;
  }

  logger.info('outbound email enabled', {
    context: 'MailModule',
    host: config.transport.host,
  });
  return nodemailer.createTransport(config.transport);
}

/**
 * Builds the `EmailMethod` registry keyed by method name. Constructed once
 * at boot regardless of whether mail is enabled — `NativeEmailMethod` holds
 * onto the transporter (`null` when disabled) but is never invoked in that
 * case, since `MailService.sendEmail` short-circuits before resolving a
 * method.
 * @param {Transporter | null} transport - The boot-time transporter, or
 *   `null` when outbound email is disabled.
 * @returns {Record<string, EmailMethod>} The registry, currently holding
 *   only the `native` method.
 */
function createMailMethods(transport: Transporter | null): Record<string, EmailMethod> {
  return {
    native: new NativeEmailMethod(transport as Transporter),
  };
}

/**
 * Always-on outbound-email module (imported directly into `AppModule`, not
 * lazy-loaded). Resolves `KERGHAN_EMAIL_*` once into a frozen `MailConfig`,
 * builds the nodemailer transporter from it, and exports `MailService` for
 * other modules' direct-DI use. This is the only file that imports
 * `nodemailer`.
 */
@Module({
  providers: [
    {
      provide: MAIL_CONFIG,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): MailConfig => buildMailConfig(configService),
    },
    {
      provide: MAIL_TRANSPORT,
      inject: [MAIL_CONFIG, LoggerService],
      useFactory: (config: MailConfig, logger: LoggerService): Transporter | null =>
        createMailTransport(config, logger),
    },
    {
      provide: MAIL_METHODS,
      inject: [MAIL_TRANSPORT],
      useFactory: (transport: Transporter | null): Record<string, EmailMethod> =>
        createMailMethods(transport),
    },
    MailService,
  ],
  exports: [MailService],
})
// NestJS module classes are intentionally empty; all behavior lives in @Module().
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class MailModule {}
