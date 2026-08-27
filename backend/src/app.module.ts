import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { CacheTokenService } from './core/cache-token.service.js';
import { JwtGuard } from './core/jwt.guard.js';
import { LazyModuleLoaderService } from './core/lazy-module-loader.service.js';
import { HealthController } from './health/health.controller.js';

// Default access-token lifetime (15 minutes, in milliseconds) used when
// `KERGHAN_ACCESS_TOKEN_TTL_MS` is unset — must match
// `auth/auth.controller.ts`'s default so the cookie's `maxAge` always
// tracks the signed JWT's actual expiry.
export const DEFAULT_ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;

/**
 * Builds `JwtModule`'s `signOptions` from `KERGHAN_ACCESS_TOKEN_TTL_MS`
 * (milliseconds; same env var and default as the access-token cookie's
 * `maxAge` in `auth/auth.controller.ts`). Exported standalone, separate
 * from the `useFactory` inline below, so its millisecond-to-second
 * conversion is unit-testable without booting the full `AppModule` (which
 * would otherwise require a live database).
 * @param {ConfigService} configService - Supplies `KERGHAN_ACCESS_TOKEN_TTL_MS`.
 * @returns {{ expiresIn: number }} `jsonwebtoken`'s `signOptions`, with
 *   `expiresIn` in seconds — `jsonwebtoken` treats a numeric `expiresIn` as
 *   seconds, not milliseconds (`node_modules/jsonwebtoken/lib/timespan.js`).
 */
export function buildJwtSignOptions(configService: ConfigService): { expiresIn: number } {
  const ttlMs = configService.get<number>('KERGHAN_ACCESS_TOKEN_TTL_MS', DEFAULT_ACCESS_TOKEN_TTL_MS);
  return { expiresIn: Math.floor(ttlMs / 1000) };
}

/**
 * Root application module. Wires global configuration, the database
 * connection, and the core JWT guard/cache-token service (per the issue's
 * "Core" module classification — always resident, at boot, independent of
 * any feature module); feature modules (Auth, and later lazy modules) are
 * imported here as they are introduced.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    AuthModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql' as const,
        host: configService.get<string>('KERGHAN_MYSQL_HOST'),
        port: configService.get<number>('KERGHAN_MYSQL_PORT', 3306),
        username: configService.get<string>('KERGHAN_MYSQL_USER'),
        password: configService.get<string>('KERGHAN_MYSQL_PASSWORD'),
        database: configService.get<string>('KERGHAN_MYSQL_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        poolSize: 5,
      }),
    }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('KERGHAN_SECRET_KEY'),
        signOptions: buildJwtSignOptions(configService),
      }),
    }),
  ],
  controllers: [HealthController],
  providers: [
    CacheTokenService,
    LazyModuleLoaderService,
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
  ],
})
// NestJS module classes are intentionally empty; all behavior lives in @Module().
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
