import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';

/**
 * Boots the Nest application, wiring cookie parsing (needed for the
 * httpOnly access-token cookie added by the Auth module), global request
 * DTO validation (`class-validator`, used by the Auth module's DTOs), and
 * reading runtime configuration (`PORT`, `KERGHAN_SECRET_KEY`) through
 * `@nestjs/config` rather than reading `process.env` directly.
 * @returns {Promise<void>} Resolves once the HTTP server is listening.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(cookieParser(configService.get<string>('KERGHAN_SECRET_KEY')));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = configService.get<number>('PORT', 8080);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.warn(`Kerghan backend listening on port ${port}`);
}

bootstrap();
