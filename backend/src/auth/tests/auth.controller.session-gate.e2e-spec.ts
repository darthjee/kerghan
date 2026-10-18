import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { loginAs, ProtectedTestController, registerUser, useTestApp } from './auth.controller.e2e-test-support.js';
import { cookieValue, pickCookie, refreshCookieFor, refreshTokenOf } from './support/auth-requests.js';
import { buildAuthTestApp, BuildAuthTestAppResult } from './support/build-auth-test-app.js';
import { expectErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';
import type { User, UserStatus } from '../entities/user.entity.js';

interface SignedIn {
  accessCookie: string;
  refreshToken: string;
}

const INVALID_TOKEN = {
  status: 401,
  code: ErrorCodes.UNAUTHORIZED,
  message: 'Invalid or expired access token',
};

function signedIn(response: request.Response): SignedIn {
  return { accessCookie: pickCookie(response, 'access_token'), refreshToken: refreshTokenOf(response) };
}

function sidOf(app: INestApplication, response: request.Response): string {
  return app.get(JwtService).decode<{ sid: string }>(cookieValue(response, 'access_token')).sid;
}

function get(app: INestApplication, path: string, accessCookie: string): request.Test {
  return request(app.getHttpServer()).get(path).set('Cookie', [accessCookie]);
}

function refresh(app: INestApplication, refreshToken: string): request.Test {
  return request(app.getHttpServer()).post('/auth/refresh.json').set('Cookie', [refreshCookieFor(refreshToken)]);
}

// The error body without its per-response `timestamp`, for byte-for-byte comparisons.
function errorWithoutTimestamp(response: request.Response): object {
  const rest = { ...(response.body as Record<string, unknown>) };

  delete rest.timestamp;

  return { status: response.status, ...rest };
}

function signedCookie(app: INestApplication, claims: Record<string, unknown>): string {
  return `access_token=${app.get(JwtService).sign(claims)}`;
}

describe('AuthController (e2e)', () => {
  describe('JwtGuard session gate', () => {
    const ctx = useTestApp({ adminGuard: true });

    let session: SignedIn;
    let loginResponse: request.Response;

    beforeEach(async () => {
      loginResponse = await loginAs(ctx.app).expect(201);
      session = signedIn(loginResponse);
    });

    function darthjee(): User {
      const user = ctx.userRepo.rows.find((row) => row.email === 'darthjee@example.com');

      if (!user) {
        throw new Error('darthjee not registered');
      }

      return user;
    }

    it('lets an active session of the token\'s sub through', async () => {
      await get(ctx.app, '/protected', session.accessCookie).expect(200, { ok: true });
    });

    it('rejects the old access token right after logoff', async () => {
      await request(ctx.app.getHttpServer())
        .delete('/auth/logoff.json')
        .set('Cookie', [refreshCookieFor(session.refreshToken)])
        .expect(204);

      expectErrorBody(await get(ctx.app, '/protected', session.accessCookie), INVALID_TOKEN);
    });

    it('rejects the old access token right after its session is revoked', async () => {
      const sid = sidOf(ctx.app, loginResponse);

      await request(ctx.app.getHttpServer())
        .post(`/auth/sessions/${sid}/revoke.json`)
        .set('Cookie', [session.accessCookie, refreshCookieFor(session.refreshToken)])
        .expect(201);

      expectErrorBody(await get(ctx.app, '/protected', session.accessCookie), INVALID_TOKEN);
    });

    it('rejects a token whose session row has expired', async () => {
      ctx.refreshTokenRepo.rows.forEach((row) => {
        row.expiresAt = new Date(Date.now() - 1000);
      });

      expectErrorBody(await get(ctx.app, '/protected', session.accessCookie), INVALID_TOKEN);
    });

    it('rejects a token with an unknown sid', async () => {
      const cookie = signedCookie(ctx.app, {
        sub: darthjee().id,
        sid: '00000000-0000-4000-8000-000000000000',
        username: 'darthjee',
        isAdmin: false,
      });

      expectErrorBody(await get(ctx.app, '/protected', cookie), INVALID_TOKEN);
    });

    it('rejects a token carrying another user\'s session sid', async () => {
      const other = await registerUser(ctx.app, { username: 'other', email: 'other@example.com' }).expect(201);
      const cookie = signedCookie(ctx.app, {
        sub: darthjee().id,
        sid: sidOf(ctx.app, other),
        username: 'darthjee',
        isAdmin: false,
      });

      expectErrorBody(await get(ctx.app, '/protected', cookie), INVALID_TOKEN);
    });

    it('rejects a sid-less token, and the retried request passes after a refresh', async () => {
      const legacy = signedCookie(ctx.app, { sub: darthjee().id, username: 'darthjee', isAdmin: false });

      expectErrorBody(await get(ctx.app, '/protected', legacy), INVALID_TOKEN);

      const refreshed = await refresh(ctx.app, session.refreshToken).expect(201);

      await get(ctx.app, '/protected', pickCookie(refreshed, 'access_token')).expect(200, { ok: true });
    });

    it('keeps the same sid across a refresh, and the rotated token passes', async () => {
      const refreshed = await refresh(ctx.app, session.refreshToken).expect(201);

      expect(sidOf(ctx.app, refreshed)).toBe(sidOf(ctx.app, loginResponse));
      await get(ctx.app, '/protected', pickCookie(refreshed, 'access_token')).expect(200, { ok: true });
    });

    it('refuses an admin-only route on the next request after a demotion', async () => {
      const user = darthjee();

      user.isAdmin = true;
      await get(ctx.app, '/protected/admin', session.accessCookie).expect(200);

      user.isAdmin = false;
      await get(ctx.app, '/protected/admin', session.accessCookie).expect(403);
    });

    it('exposes the current username through @CurrentUser() after a rename', async () => {
      const user = darthjee();

      user.username = 'renamed';

      const response = await get(ctx.app, '/protected/me', session.accessCookie).expect(200);

      expect(response.body).toEqual({
        sub: user.id,
        sid: sidOf(ctx.app, loginResponse),
        username: 'renamed',
        isAdmin: false,
      });
    });
  });

  describe('JwtGuard session gate, rule 3 (approved users only)', () => {
    let built: BuildAuthTestAppResult;

    afterEach(async () => {
      await built.app.close();
    });

    async function build(approvalRequired: boolean): Promise<void> {
      built = await buildAuthTestApp({
        controllers: [ProtectedTestController],
        configOverrides: { KERGHAN_USER_APPROVAL_REQUIRED: String(approvalRequired) },
      });
    }

    function setStatus(status: UserStatus): void {
      built.userRepo.rows[0].status = status;
    }

    async function unknownSidResponse(): Promise<request.Response> {
      const cookie = signedCookie(built.app, {
        sub: built.userRepo.rows[0].id,
        sid: '00000000-0000-4000-8000-000000000000',
        username: 'darthjee',
        isAdmin: false,
      });

      return get(built.app, '/protected', cookie);
    }

    describe.each([false, true])('with KERGHAN_USER_APPROVAL_REQUIRED %p', (approvalRequired) => {
      let session: SignedIn;

      beforeEach(async () => {
        await build(approvalRequired);
        session = signedIn(await loginAs(built.app).expect(201));
      });

      it('lets an approved user through', async () => {
        setStatus('approved');

        await get(built.app, '/protected', session.accessCookie).expect(200, { ok: true });
      });

      it.each(['pending', 'denied'] as const)(
        'answers a %s user\'s otherwise valid token with the invalid-token 401, byte-for-byte',
        async (status) => {
          setStatus(status);

          const response = await get(built.app, '/protected', session.accessCookie);

          expectErrorBody(response, INVALID_TOKEN);
          expect(errorWithoutTimestamp(response)).toEqual(errorWithoutTimestamp(await unknownSidResponse()));
        },
      );
    });

    it('blocks a user registered pending, and lets the same session through once approved', async () => {
      await build(true);

      expect(built.userRepo.rows[0].status).toBe('pending');

      const session = signedIn(await loginAs(built.app).expect(201));

      expectErrorBody(await get(built.app, '/protected', session.accessCookie), INVALID_TOKEN);

      setStatus('approved');

      await get(built.app, '/protected', session.accessCookie).expect(200, { ok: true });
    });
  });
});
