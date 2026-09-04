import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { MailModule } from '../mail/mail.module.js';
import { PasswordResetToken } from './entities/password-reset-token.entity.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { Session } from './entities/session.entity.js';
import { User } from './entities/user.entity.js';
import { PasswordRecoveryRequestedListener } from './events/password-recovery-requested.listener.js';
import { PasswordResetService } from './password-reset.service.js';

/**
 * The Auth module — always-on (imported directly into `AppModule`, not
 * lazy-loaded), per the issue's module classification. Exports `AuthService`
 * for other modules' direct-DI reads, per the hybrid inter-module
 * communication pattern (a module never writes to another module's tables;
 * reads happen only through the exported service).
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, RefreshToken, Session, PasswordResetToken]), MailModule],
  controllers: [AuthController, AdminController],
  providers: [AuthService, AdminService, PasswordResetService, PasswordRecoveryRequestedListener],
  exports: [AuthService],
})
// NestJS module classes are intentionally empty; all behavior lives in @Module().
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AuthModule {}
