import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { Session } from './entities/session.entity.js';
import { User } from './entities/user.entity.js';

/**
 * The Auth module — always-on (imported directly into `AppModule`, not
 * lazy-loaded), per the issue's module classification. Exports `AuthService`
 * for other modules' direct-DI reads, per the hybrid inter-module
 * communication pattern (a module never writes to another module's tables;
 * reads happen only through the exported service).
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, RefreshToken, Session])],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
