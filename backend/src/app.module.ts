import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health/health.controller.js';

/**
 * Root application module. Wires global configuration and the database
 * connection; feature modules (Auth, and later lazy modules) are imported
 * here as they are introduced.
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
