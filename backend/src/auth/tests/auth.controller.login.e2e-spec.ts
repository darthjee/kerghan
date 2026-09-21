import { loginAs, useTestApp } from './auth.controller.e2e-test-support.js';

describe('AuthController (e2e)', () => {
  const ctx = useTestApp();

  describe('login flow', () => {
    it('logs in with valid credentials, returning the user and a refresh token', async () => {
      const response = await loginAs(ctx.app).expect(201);

      expect(response.body).toEqual({
        user: {
          id: expect.any(Number),
          username: 'darthjee',
          email: 'darthjee@example.com',
          isAdmin: false,
        },
        refreshToken: expect.any(String),
      });
    });

    it('rejects an invalid password', async () => {
      await loginAs(ctx.app, 'darthjee', 'wrong-password').expect(401);
    });

    it('sets the access token as an httpOnly, secure, SameSite=Strict cookie', async () => {
      const response = await loginAs(ctx.app).expect(201);

      const cookie = response.headers['set-cookie'][0];

      expect(cookie).toMatch(/^access_token=/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Secure/);
      expect(cookie).toMatch(/SameSite=Strict/);
    });
  });

  describe('access-token cookie maxAge', () => {
    it('defaults to 900 seconds (15 minutes) when KERGHAN_ACCESS_TOKEN_TTL_MS is unset', async () => {
      const response = await loginAs(ctx.app).expect(201);

      const cookie = response.headers['set-cookie'][0];

      expect(cookie).toMatch(/Max-Age=900\b/);
    });
  });
});
