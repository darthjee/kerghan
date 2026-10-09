import { INestApplication } from '@nestjs/common';
import request from 'supertest';

// Issues `POST /auth/login.json` against `app`. Returns the un-awaited supertest `Test`, so callers can
// either `await` it for the full response or chain their own `.expect(status)` (failing-login specs
// assert their own status). Defaults to the seeded `darthjee` user.
export function loginAs(app: INestApplication, username = 'darthjee', password = 'my-password'): request.Test {
  return request(app.getHttpServer()).post('/auth/login.json').send({ username, password });
}

// Returns every `Set-Cookie` header of `response` (an empty list when none is set).
export function setCookieHeaders(response: request.Response): string[] {
  const header = response.headers['set-cookie'] as string | string[] | undefined;

  if (!header) {
    return [];
  }

  return Array.isArray(header) ? header : [header];
}

// Returns the full `Set-Cookie` header (`name=value; Path=...; ...`) for the cookie `name`, or `undefined`.
export function findSetCookie(response: request.Response, name: string): string | undefined {
  return setCookieHeaders(response).find((header) => header.startsWith(`${name}=`));
}

// Returns the `name=value` pair of the cookie `name` set by `response`, to replay via
// `.set('Cookie', [cookie])`. Throws when the cookie isn't set, so a spec fails loudly.
export function pickCookie(response: request.Response, name: string): string {
  const header = findSetCookie(response, name);

  if (!header) {
    throw new Error(`cookie ${name} not set`);
  }

  return header.split(';')[0];
}

// Returns the raw value of the cookie `name` set by `response`.
export function cookieValue(response: request.Response, name: string): string {
  return pickCookie(response, name).slice(name.length + 1);
}

// Returns the `refresh_token=<value>` cookie pair set by `response`, to replay via `.set('Cookie', [cookie])`.
export function refreshCookie(response: request.Response): string {
  return pickCookie(response, 'refresh_token');
}

// Returns the raw refresh token carried by the `refresh_token` cookie `response` set.
export function refreshTokenOf(response: request.Response): string {
  return cookieValue(response, 'refresh_token');
}

// Builds a `refresh_token=<token>` cookie pair from a raw token.
export function refreshCookieFor(token: string): string {
  return `refresh_token=${token}`;
}

// Logs `username` in against `app` and returns the `access_token` cookie (`name=value`) to replay
// via `.set('Cookie', [cookie])`.
export async function loginCookie(
  app: INestApplication,
  username?: string,
  password?: string,
): Promise<string> {
  const response = await loginAs(app, username, password);
  return pickCookie(response, 'access_token');
}

// Logs `username` in against `app` and returns both its `access_token` and `refresh_token` cookie
// pairs, plus the raw refresh token, for specs that act on the caller's current session.
export async function loginSession(
  app: INestApplication,
  username?: string,
  password?: string,
): Promise<{ accessCookie: string; refreshCookie: string; refreshToken: string }> {
  const response = await loginAs(app, username, password);

  return {
    accessCookie: pickCookie(response, 'access_token'),
    refreshCookie: refreshCookie(response),
    refreshToken: refreshTokenOf(response),
  };
}

// Issues `POST /auth/register.json` against `app`. Returns the un-awaited supertest `Test`, like `loginAs`.
export function registerUser(
  app: INestApplication,
  { username, email, password = 'my-password' }: { username: string; email: string; password?: string },
): request.Test {
  return request(app.getHttpServer()).post('/auth/register.json').send({ username, email, password });
}
