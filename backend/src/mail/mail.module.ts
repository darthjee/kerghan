import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { buildMailConfig, type MailConfig } from './mail.config.js';
import { MailService } from './mail.service.js';
import { MAIL_CONFIG, MAIL_TRANSPORT } from './mail.tokens.js';

export { MAIL_CONFIG, MAIL_TRANSPORT } from './mail.tokens.js';

/**
 * Builds the boot-time transporter from the resolved config. Returns
 * `null` (and logs once) when outbound email is disabled; otherwise logs
 * `enabled` plus the host only — never the whole config, which holds the
 * SMTP password.
 * @param {MailConfig} config - The frozen config from `buildMailConfig`.
 * @returns {nodemailer.Transporter | null} The transporter, or `null` when disabled.
 */
function createMailTransport(config: MailConfig): nodemailer.Transporter | null {
  const logger = new Logger('MailModule');

  if (!config.enabled || !config.transport) {
    logger.log('outbound email disabled');
    return null;
  }

  logger.log(`outbound email enabled (host=${config.transport.host})`);
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
      inject: [MAIL_CONFIG],
      useFactory: (config: MailConfig): nodemailer.Transporter | null => createMailTransport(config),
    },
    MailService,
  ],
  exports: [MailService],
})
// NestJS module classes are intentionally empty; all behavior lives in @Module().
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class MailModule {}
