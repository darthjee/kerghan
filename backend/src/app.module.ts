import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheTokenService } from './core/cache-token.service.js';
import { JwtGuard } from './core/jwt.guard.js';
import { HealthController } from './health/health.controller.js';

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
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('KERGHAN_SECRET_KEY'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [HealthController],
  providers: [
    CacheTokenService,
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
  ],
})
export class AppModule {}
