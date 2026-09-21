import { INestApplication } from '@nestjs/common';
import request from 'supertest';

// Issues `POST /auth/login.json` against `app` and returns the full response (no `.expect`, so
// failing-login specs can assert their own status). Defaults to the seeded `darthjee` user.
export async function loginAs(
  app: INestApplication,
  username = 'darthjee',
  password = 'my-password',
): Promise<request.Response> {
  return request(app.getHttpServer()).post('/auth/login.json').send({ username, password });
}

// Logs `username` in against `app` and returns the `access_token` cookie (`name=value`) to replay
// via `.set('Cookie', [cookie])`.
export async function loginCookie(
  app: INestApplication,
  username?: string,
  password?: string,
): Promise<string> {
  const response = await loginAs(app, username, password);
  return response.headers['set-cookie'][0].split(';')[0];
}

// Issues `POST /auth/register.json` against `app` and returns the full response.
export async function registerUser(
  app: INestApplication,
  { username, email, password = 'my-password' }: { username: string; email: string; password?: string },
): Promise<request.Response> {
  return request(app.getHttpServer()).post('/auth/register.json').send({ username, email, password });
}
