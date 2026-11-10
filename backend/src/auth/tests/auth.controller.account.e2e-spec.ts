import { createHash } from 'node:crypto';
import request from 'supertest';
import { loginAs, loginCookie, registerUser, useTestApp } from './auth.controller.e2e-test-support.js';
import { refreshCookieFor, refreshTokenOf as refreshTokenFrom } from './support/auth-requests.js';
import { expectErrorBody, expectValidationErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';

describe('AuthController (e2e)', () => {
  const ctx = useTestApp();

  describe('PATCH /auth/account.json', () => {
    function patchAccount(cookie: string | string[], body: Record<string, unknown>): request.Test {
      return request(ctx.app.getHttpServer())
        .patch('/auth/account.json')
        .set('Cookie', Array.isArray(cookie) ? cookie : [cookie])
        .send(body);
    }

    it('rejects an unauthenticated request', async () => {
      await request(ctx.app.getHttpServer())
        .patch('/auth/account.json')
        .send({ currentPassword: 'my-password', username: 'new-username' })
        .expect(401);
    });

    describe('with the right current password', () => {
      let response: request.Response;

      beforeEach(async () => {
        const cookie = await loginCookie(ctx.app);

        response = await patchAccount(cookie, {
          currentPassword: 'my-password',
          username: 'new-username',
        }).expect(200);
      });

      it('updates the username and responds with { username, email, githubHandle }', () => {
        expect(response.body).toEqual({ username: 'new-username', email: 'darthjee@example.com', githubHandle: null });
      });

      it('sets the X-Skip-Cache header', () => {
        expect(response.headers['x-skip-cache']).toBe('true');
      });
    });

    it('never changes the caller\'s status', async () => {
      const cookie = await loginCookie(ctx.app);

      await patchAccount(cookie, { currentPassword: 'my-password', username: 'new-username', newPassword: 'brand-new-password' })
        .expect(200);

      expect(ctx.userRepo.rows[0].status).toBe('approved');
    });

    it('rejects the wrong current password without changing the account', async () => {
      const cookie = await loginCookie(ctx.app);

      const response = await patchAccount(cookie, { currentPassword: 'wrong-password', username: 'new-username' });

      expectErrorBody(response, { status: 400, code: ErrorCodes.BAD_REQUEST, message: 'Invalid current password' });
      expect(ctx.userRepo.rows[0].username).toBe('darthjee');
    });

    it('answers a managed field without a current password with 400, changing nothing', async () => {
      const cookie = await loginCookie(ctx.app);

      const response = await patchAccount(cookie, { username: 'new-username', githubHandle: 'darthjee' });

      expectErrorBody(response, { status: 400, code: ErrorCodes.BAD_REQUEST, message: 'currentPassword is required' });
      expect(ctx.userRepo.rows[0]).toMatchObject({ username: 'darthjee' });
      expect(ctx.userRepo.rows[0].githubHandle ?? null).toBeNull();
    });

    it('answers an empty current password with 400 VALIDATION_FAILED', async () => {
      const cookie = await loginCookie(ctx.app);

      const response = await patchAccount(cookie, { username: 'new-username', currentPassword: '' });

      expectValidationErrorBody(response);
      expect(response.body.error.details).toContain('currentPassword should not be empty');
    });

    describe('githubHandle', () => {
      const ACCOUNT_MESSAGE = 'At least one of username, email, newPassword or githubHandle is required';

      it('answers a handle-only edit with 200 and { username, email, githubHandle }, without currentPassword', async () => {
        const cookie = await loginCookie(ctx.app);

        const response = await patchAccount(cookie, { githubHandle: '  @DarthJee ' }).expect(200);

        expect(response.body).toEqual({ username: 'darthjee', email: 'darthjee@example.com', githubHandle: 'darthjee' });
        expect(response.headers['x-skip-cache']).toBe('true');
        expect(ctx.userRepo.rows[0].githubHandle).toBe('darthjee');
      });

      it('ignores a wrong currentPassword on a handle-only edit', async () => {
        const cookie = await loginCookie(ctx.app);

        const response = await patchAccount(cookie, { githubHandle: 'darthjee', currentPassword: 'wrong-password' })
          .expect(200);

        expect(response.body.githubHandle).toBe('darthjee');
      });

      it('never counts handle-only edits toward the lockout', async () => {
        const cookie = await loginCookie(ctx.app);

        for (let i = 0; i < 6; i += 1) {
          await patchAccount(cookie, { githubHandle: `handle-${i}`, currentPassword: 'wrong-password' }).expect(200);
        }

        await patchAccount(cookie, { currentPassword: 'my-password', username: 'new-username' }).expect(200);
      }, 15000);

      it('succeeds while the user is locked out', async () => {
        const cookie = await loginCookie(ctx.app);

        for (let i = 0; i < 5; i += 1) {
          await patchAccount(cookie, { currentPassword: 'wrong-password', username: 'new-username' }).expect(400);
        }

        await patchAccount(cookie, { currentPassword: 'my-password', username: 'new-username' }).expect(423);
        await patchAccount(cookie, { githubHandle: 'darthjee' }).expect(200);
      }, 15000);

      it.each([[null], [''], ['  '], ['@']])('clears the handle with %p', async (value) => {
        const cookie = await loginCookie(ctx.app);
        await patchAccount(cookie, { githubHandle: 'darthjee' }).expect(200);

        const response = await patchAccount(cookie, { githubHandle: value }).expect(200);

        expect(response.body.githubHandle).toBeNull();
        expect(ctx.userRepo.rows[0].githubHandle).toBeNull();
      });

      it.each(['a'.repeat(40), '-a', 'a-', 'a--b', 'a_b', 'a.b', 'a/b', 'a b', 'dárth'])(
        'answers the invalid handle %p with 400 VALIDATION_FAILED and stores nothing',
        async (value) => {
          const cookie = await loginCookie(ctx.app);

          const response = await patchAccount(cookie, { githubHandle: value });

          expectValidationErrorBody(response);
          expect(response.body.error.details).toContain('githubHandle must be a valid GitHub username');
          expect(ctx.userRepo.rows[0].githubHandle ?? null).toBeNull();
        },
      );

      it.each([[42], [true], [{ login: 'x' }], [['x']]])('answers the non-string value %p with 400 VALIDATION_FAILED', async (value) => {
        const cookie = await loginCookie(ctx.app);

        expectValidationErrorBody(await patchAccount(cookie, { githubHandle: value }));
      });

      it.each(['username', 'email', 'newPassword'])('answers a null %s with 400 VALIDATION_FAILED', async (field) => {
        const cookie = await loginCookie(ctx.app);

        const response = await patchAccount(cookie, { [field]: null, githubHandle: 'darthjee', currentPassword: 'my-password' });

        expectValidationErrorBody(response);
        expect(ctx.userRepo.rows[0].githubHandle ?? null).toBeNull();
      });

      it.each([[{}], [{ currentPassword: 'my-password' }]])('answers %p with 400 and the account message', async (body) => {
        const cookie = await loginCookie(ctx.app);

        expectErrorBody(await patchAccount(cookie, body), { status: 400, code: ErrorCodes.BAD_REQUEST, message: ACCOUNT_MESSAGE });
      });

      it('stores the handle with a mixed edit', async () => {
        const cookie = await loginCookie(ctx.app);

        const response = await patchAccount(cookie, {
          currentPassword: 'my-password', username: 'new-username', githubHandle: 'darthjee',
        }).expect(200);

        expect(response.body).toEqual({ username: 'new-username', email: 'darthjee@example.com', githubHandle: 'darthjee' });
      });

      it('stores no handle when a mixed edit has a wrong currentPassword', async () => {
        const cookie = await loginCookie(ctx.app);

        await patchAccount(cookie, { currentPassword: 'wrong-password', username: 'x', githubHandle: 'darthjee' })
          .expect(400);

        expect(ctx.userRepo.rows[0].githubHandle ?? null).toBeNull();
      });

      it('saves a handle another user already holds, revealing nothing', async () => {
        await registerUser(ctx.app, { username: 'obi-wan', email: 'obi-wan@example.com' });
        const obiWan = ctx.userRepo.rows.find((row) => row.username === 'obi-wan');
        (obiWan as { githubHandle: string | null }).githubHandle = 'shared';
        const cookie = await loginCookie(ctx.app);

        const response = await patchAccount(cookie, { githubHandle: 'Shared' }).expect(200);

        expect(response.body).toEqual({ username: 'darthjee', email: 'darthjee@example.com', githubHandle: 'shared' });
      });
    });

    describe('when the new username/email belongs to another user', () => {
      beforeEach(async () => {
        await registerUser(ctx.app, { username: 'obi-wan', email: 'obi-wan@example.com' });
      });

      it('answers a taken username with 409 USERNAME_TAKEN', async () => {
        const cookie = await loginCookie(ctx.app);

        const response = await patchAccount(cookie, { currentPassword: 'my-password', username: 'obi-wan' });

        expectErrorBody(response, {
          status: 409,
          code: ErrorCodes.USERNAME_TAKEN,
          message: 'Username already in use',
        });
        expect(ctx.userRepo.rows[0].username).toBe('darthjee');
      });

      it('answers a taken email with 409 EMAIL_TAKEN', async () => {
        const cookie = await loginCookie(ctx.app);

        const response = await patchAccount(cookie, { currentPassword: 'my-password', email: 'obi-wan@example.com' });

        expectErrorBody(response, {
          status: 409,
          code: ErrorCodes.EMAIL_TAKEN,
          message: 'Email already in use',
        });
        expect(ctx.userRepo.rows[0].email).toBe('darthjee@example.com');
      });
    });

    describe('session revocation', () => {
      const refreshTokenOf = async (username = 'darthjee'): Promise<string> =>
        refreshTokenFrom(await loginAs(ctx.app, username));

      // Reads revocation state straight from the fake repository, so the
      // assertions don't depend on `/auth/refresh.json`'s own semantics.
      const isRevoked = (refreshToken: string): boolean => {
        const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
        return ctx.refreshTokenRepo.rows.find((row) => row.tokenHash === tokenHash)?.revokedAt !== null;
      };

      it('keeps the cookie\'s session and revokes the caller\'s others on a password change', async () => {
        const current = await refreshTokenOf();
        const other = await refreshTokenOf();
        const cookie = await loginCookie(ctx.app);

        await patchAccount([cookie, refreshCookieFor(current)], {
          currentPassword: 'my-password',
          newPassword: 'brand-new-password',
        }).expect(200);

        expect(isRevoked(current)).toBe(false);
        expect(isRevoked(other)).toBe(true);
        await request(ctx.app.getHttpServer())
          .post('/auth/refresh.json')
          .set('Cookie', [refreshCookieFor(current)])
          .expect(201);
      }, 15000);

      it('ignores a body-carried refreshToken, revoking every session without the cookie', async () => {
        const current = await refreshTokenOf();
        const cookie = await loginCookie(ctx.app);

        await patchAccount(cookie, {
          currentPassword: 'my-password',
          newPassword: 'brand-new-password',
          refreshToken: current,
        }).expect(200);

        expect(isRevoked(current)).toBe(true);
      }, 15000);

      it('revokes every session of the caller when no refresh-token cookie is sent', async () => {
        const current = await refreshTokenOf();
        const cookie = await loginCookie(ctx.app);

        await patchAccount(cookie, {
          currentPassword: 'my-password',
          newPassword: 'brand-new-password',
        }).expect(200);

        expect(isRevoked(current)).toBe(true);
      });

      it('revokes every session of the caller, and nobody else\'s, when a foreign token cookie is sent', async () => {
        await registerUser(ctx.app, { username: 'obi-wan', email: 'obi-wan@example.com' });
        const current = await refreshTokenOf();
        const foreign = await refreshTokenOf('obi-wan');
        const cookie = await loginCookie(ctx.app);

        await patchAccount([cookie, refreshCookieFor(foreign)], {
          currentPassword: 'my-password',
          newPassword: 'brand-new-password',
        }).expect(200);

        expect(isRevoked(current)).toBe(true);
        expect(isRevoked(foreign)).toBe(false);
      }, 15000);

      it('revokes every session of the caller when an unknown token cookie is sent', async () => {
        const current = await refreshTokenOf();
        const cookie = await loginCookie(ctx.app);

        await patchAccount([cookie, refreshCookieFor('not-a-real-token')], {
          currentPassword: 'my-password',
          newPassword: 'brand-new-password',
        }).expect(200);

        expect(isRevoked(current)).toBe(true);
      });

      it('revokes nothing on a username-only change, even with a refresh-token cookie sent', async () => {
        const current = await refreshTokenOf();
        const other = await refreshTokenOf();
        const cookie = await loginCookie(ctx.app);

        await patchAccount([cookie, refreshCookieFor(current)], {
          currentPassword: 'my-password',
          username: 'new-username',
        }).expect(200);

        expect(isRevoked(current)).toBe(false);
        expect(isRevoked(other)).toBe(false);
      }, 15000);

      it('revokes nothing when the password change fails validation', async () => {
        const other = await refreshTokenOf();
        const cookie = await loginCookie(ctx.app);

        await patchAccount(cookie, {
          currentPassword: 'wrong-password',
          newPassword: 'brand-new-password',
        }).expect(400);

        expect(isRevoked(other)).toBe(false);
      });
    });

    it(
      'locks the account out with 423 after 5 failed attempts, even with the right password',
      async () => {
        const cookie = await loginCookie(ctx.app);

        for (let i = 0; i < 5; i += 1) {
          await patchAccount(cookie, { currentPassword: 'wrong-password', username: 'new-username' })
            .expect(400);
        }

        const response = await patchAccount(cookie, { currentPassword: 'my-password', username: 'new-username' });

        expectErrorBody(response, {
          status: 423,
          code: ErrorCodes.LOCKED,
          message: 'Account temporarily locked due to too many failed attempts',
        });
      },
      15000,
    );
  });

  describe('POST /auth/account/mine.json', () => {
    function postMine(cookie: string): request.Test {
      return request(ctx.app.getHttpServer()).post('/auth/account/mine.json').set('Cookie', [cookie]);
    }

    it('rejects an unauthenticated request', async () => {
      await request(ctx.app.getHttpServer()).post('/auth/account/mine.json').expect(401);
    });

    it('answers 201 with the session user\'s own { username, email, githubHandle }', async () => {
      await registerUser(ctx.app, { username: 'obi-wan', email: 'obi-wan@example.com' });
      ctx.userRepo.rows[0].githubHandle = 'darthjee';

      const response = await postMine(await loginCookie(ctx.app)).expect(201);

      expect(response.body).toEqual({ username: 'darthjee', email: 'darthjee@example.com', githubHandle: 'darthjee' });
    });

    it('answers a null githubHandle when unset', async () => {
      const response = await postMine(await loginCookie(ctx.app)).expect(201);

      expect(response.body.githubHandle).toBeNull();
    });

    it('sets the X-Skip-Cache header', async () => {
      const response = await postMine(await loginCookie(ctx.app)).expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
    });

    it('answers 401 when the session user no longer exists', async () => {
      const cookie = await loginCookie(ctx.app);
      ctx.userRepo.rows.splice(0, ctx.userRepo.rows.length);

      await postMine(cookie).expect(401);
    });
  });
});
