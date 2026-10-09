import request from 'supertest';
import { loginAs, useTestApp } from './auth.controller.e2e-test-support.js';
import { findSetCookie } from './support/auth-requests.js';
import { expectErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';

describe('AuthController (e2e)', () => {
  const ctx = useTestApp();

  describe('login flow', () => {
    it('logs in with valid credentials, returning only the user (no refresh token in the body)', async () => {
      const response = await loginAs(ctx.app).expect(201);

      expect(response.body).toEqual({
        user: {
          id: expect.any(Number),
          username: 'darthjee',
          email: 'darthjee@example.com',
          isAdmin: false,
        },
      });
    });

    it('rejects an invalid password with 401 UNAUTHORIZED', async () => {
      const response = await loginAs(ctx.app, 'darthjee', 'wrong-password');

      expectErrorBody(response, {
        status: 401,
        code: ErrorCodes.UNAUTHORIZED,
        message: 'Invalid username or password',
      });
    });

    it('rejects an unknown username with the same 401 body as a wrong password', async () => {
      const response = await loginAs(ctx.app, 'nobody', 'wrong-password');

      expectErrorBody(response, {
        status: 401,
        code: ErrorCodes.UNAUTHORIZED,
        message: 'Invalid username or password',
      });
    });

    it('sets the access token as an httpOnly, secure, SameSite=Strict cookie', async () => {
      const response = await loginAs(ctx.app).expect(201);

      const cookie = findSetCookie(response, 'access_token');

      expect(cookie).toMatch(/^access_token=[^;]+;/);
      expect(cookie).toMatch(/Path=\/;/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Secure/);
      expect(cookie).toMatch(/SameSite=Strict/);
    });

    it('sets the refresh token as an httpOnly, secure, SameSite=Strict cookie scoped to /auth', async () => {
      const response = await loginAs(ctx.app).expect(201);

      const cookie = findSetCookie(response, 'refresh_token');

      expect(cookie).toMatch(/^refresh_token=[0-9a-f]+;/);
      expect(cookie).toMatch(/Path=\/auth;/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Secure/);
      expect(cookie).toMatch(/SameSite=Strict/);
    });

    it('sets a script-readable logged_in=1 cookie on /', async () => {
      const response = await loginAs(ctx.app).expect(201);

      const cookie = findSetCookie(response, 'logged_in');

      expect(cookie).toMatch(/^logged_in=1;/);
      expect(cookie).toMatch(/Path=\/;/);
      expect(cookie).not.toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Secure/);
      expect(cookie).toMatch(/SameSite=Strict/);
    });
  });

  describe('keepSignedIn', () => {
    const login = (body: Record<string, unknown>): request.Test => request(ctx.app.getHttpServer())
      .post('/auth/login.json')
      .send({ username: 'darthjee', password: 'my-password', ...body });

    const lastRefreshToken = (): { keepSignedIn: boolean; expiresAt: Date } => {
      const { rows } = ctx.refreshTokenRepo;

      return rows[rows.length - 1] as never;
    };

    it('accepts keepSignedIn: true, minting a persistent session with an unchanged body', async () => {
      const response = await login({ keepSignedIn: true }).expect(201);

      expect(Object.keys(response.body)).toEqual(['user']);
      expect(lastRefreshToken().keepSignedIn).toBe(true);
    });

    it('accepts an omitted keepSignedIn, minting a regular session', async () => {
      const response = await login({}).expect(201);

      expect(Object.keys(response.body)).toEqual(['user']);
      expect(lastRefreshToken().keepSignedIn).toBe(false);
    });

    it('accepts keepSignedIn: false, minting a regular session', async () => {
      await login({ keepSignedIn: false }).expect(201);

      expect(lastRefreshToken().keepSignedIn).toBe(false);
    });

    it.each([
      ['regular', false, 7 * 24 * 60 * 60],
      ['persistent', true, 30 * 24 * 60 * 60],
    ])('gives the %s session cookies a Max-Age matching its refresh-token TTL', async (_label, keepSignedIn, ttl) => {
      const response = await login({ keepSignedIn }).expect(201);

      for (const name of ['refresh_token', 'logged_in']) {
        const maxAge = Number(/Max-Age=(\d+)/.exec(findSetCookie(response, name) ?? '')?.[1]);

        expect(maxAge).toBeGreaterThanOrEqual(ttl - 5);
        expect(maxAge).toBeLessThanOrEqual(ttl);
      }
    });

    it.each([['the string "true"', 'true'], ['the number 1', 1]])(
      'rejects %s with 400',
      async (_label, value) => {
        await login({ keepSignedIn: value }).expect(400);
      },
    );
  });

  describe('oversized request body', () => {
    it('answers 413 with the standard body, not a 500', async () => {
      // Nest's default JSON body-parser limit is 100kb.
      const response = await request(ctx.app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'x'.repeat(200 * 1024) });

      expectErrorBody(response, { status: 413, code: 'HTTP_413', message: 'Payload Too Large' });
    });
  });

  describe('access-token cookie maxAge', () => {
    it('defaults to 900 seconds (15 minutes) when KERGHAN_ACCESS_TOKEN_TTL_MS is unset', async () => {
      const response = await loginAs(ctx.app).expect(201);

      const cookie = findSetCookie(response, 'access_token');

      expect(cookie).toMatch(/Max-Age=900\b/);
    });
  });
});
