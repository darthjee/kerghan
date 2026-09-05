import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { buildMailConfig, type MailConfig } from './mail.config.js';
import { MailService } from './mail.service.js';
import { MAIL_CONFIG, MAIL_TRANSPORT } from './mail.tokens.js';
import { LoggerService } from '../core/logger.service.js';

export { MAIL_CONFIG, MAIL_TRANSPORT } from './mail.tokens.js';

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
    MailService,
  ],
  exports: [MailService],
})
// NestJS module classes are intentionally empty; all behavior lives in @Module().
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class MailModule {}
