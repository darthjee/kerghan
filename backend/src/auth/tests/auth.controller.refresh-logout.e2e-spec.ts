import request from 'supertest';
import { loginAs, useTestApp } from './auth.controller.e2e-test-support.js';
import { findSetCookie, refreshCookieFor, refreshTokenOf, setCookieHeaders } from './support/auth-requests.js';

describe('AuthController (e2e)', () => {
  const ctx = useTestApp();

  function refresh(refreshToken: string): request.Test {
    return request(ctx.app.getHttpServer()).post('/auth/refresh.json').set('Cookie', [refreshCookieFor(refreshToken)]);
  }

  function logoff(refreshToken?: string): request.Test {
    const req = request(ctx.app.getHttpServer()).delete('/auth/logoff.json');

    return refreshToken ? req.set('Cookie', [refreshCookieFor(refreshToken)]) : req;
  }

  function status(refreshToken?: string): request.Test {
    const req = request(ctx.app.getHttpServer()).post('/auth/status.json');

    return refreshToken ? req.set('Cookie', [refreshCookieFor(refreshToken)]) : req;
  }

  function expectSessionCookiesCleared(response: request.Response): void {
    expect(findSetCookie(response, 'access_token')).toMatch(/^access_token=;.*Path=\/;/);
    expect(findSetCookie(response, 'refresh_token')).toMatch(/^refresh_token=;.*Path=\/auth;/);
    expect(findSetCookie(response, 'logged_in')).toMatch(/^logged_in=;.*Path=\/;/);
  }

  describe('refresh token rotation', () => {
    it('issues a new token pair from the cookie and invalidates the old refresh token', async () => {
      const oldRefreshToken = refreshTokenOf(await loginAs(ctx.app));

      const refreshed = await refresh(oldRefreshToken).expect(201);

      expect(refreshed.body).toEqual({ user: expect.objectContaining({ username: 'darthjee' }) });
      expect(refreshed.body.refreshToken).toBeUndefined();
      expect(refreshTokenOf(refreshed)).not.toBe(oldRefreshToken);
      expect(findSetCookie(refreshed, 'logged_in')).toMatch(/^logged_in=1;/);

      await refresh(oldRefreshToken).expect(401);
    });

    it('keeps the session identity (session_uuid, started_at) on the rotated row', async () => {
      const login = await loginAs(ctx.app);
      const original = ctx.refreshTokenRepo.rows[ctx.refreshTokenRepo.rows.length - 1];

      await refresh(refreshTokenOf(login)).expect(201);

      const rotated = ctx.refreshTokenRepo.rows[ctx.refreshTokenRepo.rows.length - 1];

      expect(rotated).not.toBe(original);
      expect(rotated.sessionUuid).toBe(original.sessionUuid);
      expect(rotated.startedAt).toEqual(original.startedAt);
    });

    it('treats a replayed rotated token as theft, revoking every token of the user', async () => {
      const token = refreshTokenOf(await loginAs(ctx.app));
      const refreshed = await refresh(token).expect(201);

      await refresh(token).expect(401);

      await refresh(refreshTokenOf(refreshed)).expect(401);
      expect(ctx.refreshTokenRepo.rows.map((row) => row.revokedReason)).toContain('replay_detected');
    });

    it('answers a plain 401 for an expired rotated token, revoking nothing else', async () => {
      const token = refreshTokenOf(await loginAs(ctx.app));
      const presented = ctx.refreshTokenRepo.rows[ctx.refreshTokenRepo.rows.length - 1];
      const refreshed = await refresh(token).expect(201);

      presented.expiresAt = new Date(Date.now() - 1000);

      await refresh(token).expect(401);
      await refresh(refreshTokenOf(refreshed)).expect(201);
    });

    it('answers a plain 401 for a logged-out token, revoking nothing else', async () => {
      const kept = refreshTokenOf(await loginAs(ctx.app));
      const loggedOut = refreshTokenOf(await loginAs(ctx.app));

      await logoff(loggedOut).expect(204);

      await refresh(loggedOut).expect(401);
      await refresh(kept).expect(201);
    });

    it('lets only one of two concurrent refreshes of the same token succeed', async () => {
      const token = refreshTokenOf(await loginAs(ctx.app));

      const responses = await Promise.all([refresh(token), refresh(token)]);

      expect(responses.map((response) => response.status).sort()).toEqual([201, 401]);
    });

    it('rejects an expired refresh token, clearing the session cookies', async () => {
      const token = refreshTokenOf(await loginAs(ctx.app));

      // `rows[0]` is the token issued by `register()` in the outer
      // `beforeEach` — the one under test here is the last one created, by
      // this test's own `login` call.
      ctx.refreshTokenRepo.rows[ctx.refreshTokenRepo.rows.length - 1].expiresAt = new Date(Date.now() - 1000);

      const response = await refresh(token).expect(401);

      expectSessionCookiesCleared(response);
    });

    it('answers 401 and clears the session cookies when neither cookie nor body token is sent', async () => {
      const rowsBefore = ctx.refreshTokenRepo.rows.length;

      const response = await request(ctx.app.getHttpServer()).post('/auth/refresh.json').expect(401);

      expectSessionCookiesCleared(response);
      expect(ctx.refreshTokenRepo.rows).toHaveLength(rowsBefore);
    });
  });

  describe('migration fallback (TODO(#324-migration))', () => {
    it('rotates a body-carried token when the cookie is absent, moving it into the cookie', async () => {
      const token = refreshTokenOf(await loginAs(ctx.app));

      const response = await request(ctx.app.getHttpServer())
        .post('/auth/refresh.json')
        .send({ refreshToken: token })
        .expect(201);

      expect(response.body.refreshToken).toBeUndefined();
      expect(refreshTokenOf(response)).not.toBe(token);
    });

    it('lets the cookie win over a body token when both are present', async () => {
      const cookieToken = refreshTokenOf(await loginAs(ctx.app));
      const bodyToken = refreshTokenOf(await loginAs(ctx.app));

      await refresh(cookieToken).send({ refreshToken: bodyToken }).expect(201);

      // Only the cookie's token was rotated: the body token is still active.
      await refresh(bodyToken).expect(201);
    }, 15000);
  });

  describe('logout', () => {
    it('invalidates the cookie refresh token and clears all three session cookies', async () => {
      const token = refreshTokenOf(await loginAs(ctx.app));

      const response = await logoff(token).expect(204);

      expectSessionCookiesCleared(response);

      await refresh(token).expect(401);
    });

    it('answers 204 and clears the session cookies without a cookie', async () => {
      const response = await logoff().expect(204);

      expectSessionCookiesCleared(response);
      expect(ctx.refreshTokenRepo.rows.every((row) => !row.revokedAt)).toBe(true);
    });
  });

  describe('status check', () => {
    it('resolves loggedIn: true for an active refresh-token cookie', async () => {
      const token = refreshTokenOf(await loginAs(ctx.app));

      const response = await status(token).expect(201);

      expect(response.body).toEqual({ loggedIn: true, isAdmin: false });
    });

    it('resolves loggedIn: false for an unknown refresh token, without a 401, clearing the cookies', async () => {
      const response = await status('not-a-real-token').expect(201);

      expect(response.body).toEqual({ loggedIn: false, isAdmin: false });
      expectSessionCookiesCleared(response);
    });

    it('resolves loggedIn: false without a cookie, clearing the cookies', async () => {
      const response = await status().expect(201);

      expect(response.body).toEqual({ loggedIn: false, isAdmin: false });
      expectSessionCookiesCleared(response);
    });

    it('ignores a body-carried refresh token', async () => {
      const token = refreshTokenOf(await loginAs(ctx.app));

      const response = await status().send({ refreshToken: token }).expect(201);

      expect(response.body).toEqual({ loggedIn: false, isAdmin: false });
    });

    it('resolves loggedIn: false for a revoked refresh token, without revoking the token family', async () => {
      const token = refreshTokenOf(await loginAs(ctx.app));

      await logoff(token).expect(204);

      const response = await status(token).expect(201);

      expect(response.body).toEqual({ loggedIn: false, isAdmin: false });
    });

    it('resolves isAdmin: true for an active refresh token belonging to an admin', async () => {
      ctx.userRepo.rows[0].isAdmin = true;

      const token = refreshTokenOf(await loginAs(ctx.app));

      const response = await status(token).expect(201);

      expect(response.body).toEqual({ loggedIn: true, isAdmin: true });
    });

    it('does not set or clear any cookie for an active session', async () => {
      const token = refreshTokenOf(await loginAs(ctx.app));

      const response = await status(token).expect(201);

      expect(setCookieHeaders(response)).toEqual([]);
    });

    it('is reachable without an access-token cookie, being @Public()', async () => {
      await status('whatever').expect(201);
    });

    it('sets the X-Skip-Cache header', async () => {
      const response = await status('whatever').expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
    });
  });
});
