import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';

/**
 * Boots the Nest application, wiring cookie parsing (needed for the
 * httpOnly access-token cookie added by the Auth module) and reading
 * runtime configuration (`PORT`, `KERGHAN_SECRET_KEY`) through
 * `@nestjs/config` rather than reading `process.env` directly.
 * @returns {Promise<void>} Resolves once the HTTP server is listening.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(cookieParser(configService.get<string>('KERGHAN_SECRET_KEY')));

  const port = configService.get<number>('PORT', 8080);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.warn(`Kerghan backend listening on port ${port}`);
}

bootstrap();
