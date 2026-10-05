import { createHash } from 'node:crypto';
import request from 'supertest';
import { loginAs, loginCookie, registerUser, useTestApp } from './auth.controller.e2e-test-support.js';
import { expectErrorBody, expectValidationErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';

describe('AuthController (e2e)', () => {
  const ctx = useTestApp();

  describe('PATCH /auth/account.json', () => {
    function patchAccount(cookie: string, body: Record<string, string>): request.Test {
      return request(ctx.app.getHttpServer())
        .patch('/auth/account.json')
        .set('Cookie', [cookie])
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

      it('updates the username and responds with { username, email }', () => {
        expect(response.body).toEqual({ username: 'new-username', email: 'darthjee@example.com' });
      });

      it('sets the X-Skip-Cache header', () => {
        expect(response.headers['x-skip-cache']).toBe('true');
      });
    });

    it('rejects the wrong current password without changing the account', async () => {
      const cookie = await loginCookie(ctx.app);

      const response = await patchAccount(cookie, { currentPassword: 'wrong-password', username: 'new-username' });

      expectErrorBody(response, { status: 400, code: ErrorCodes.BAD_REQUEST, message: 'Invalid current password' });
      expect(ctx.userRepo.rows[0].username).toBe('darthjee');
    });

    it('answers a missing current password with 400 VALIDATION_FAILED', async () => {
      const cookie = await loginCookie(ctx.app);

      const response = await patchAccount(cookie, { username: 'new-username' });

      expectValidationErrorBody(response);
      expect(response.body.error.details).toContain('currentPassword should not be empty');
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
        (await loginAs(ctx.app, username)).body.refreshToken;

      // Reads revocation state straight from the fake repository, so the
      // assertions don't depend on `/auth/refresh.json`'s own semantics.
      const isRevoked = (refreshToken: string): boolean => {
        const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
        return ctx.refreshTokenRepo.rows.find((row) => row.tokenHash === tokenHash)?.revokedAt !== null;
      };

      it('keeps the presented session and revokes the caller\'s others on a password change', async () => {
        const current = await refreshTokenOf();
        const other = await refreshTokenOf();
        const cookie = await loginCookie(ctx.app);

        await patchAccount(cookie, {
          currentPassword: 'my-password',
          newPassword: 'brand-new-password',
          refreshToken: current,
        }).expect(200);

        expect(isRevoked(current)).toBe(false);
        expect(isRevoked(other)).toBe(true);
        await request(ctx.app.getHttpServer())
          .post('/auth/refresh.json')
          .send({ refreshToken: current })
          .expect(201);
      }, 15000);

      it('revokes every session of the caller when no refresh token is sent', async () => {
        const current = await refreshTokenOf();
        const cookie = await loginCookie(ctx.app);

        await patchAccount(cookie, {
          currentPassword: 'my-password',
          newPassword: 'brand-new-password',
        }).expect(200);

        expect(isRevoked(current)).toBe(true);
      });

      it('revokes every session of the caller, and nobody else\'s, when a foreign token is sent', async () => {
        await registerUser(ctx.app, { username: 'obi-wan', email: 'obi-wan@example.com' });
        const current = await refreshTokenOf();
        const foreign = await refreshTokenOf('obi-wan');
        const cookie = await loginCookie(ctx.app);

        await patchAccount(cookie, {
          currentPassword: 'my-password',
          newPassword: 'brand-new-password',
          refreshToken: foreign,
        }).expect(200);

        expect(isRevoked(current)).toBe(true);
        expect(isRevoked(foreign)).toBe(false);
      }, 15000);

      it('revokes every session of the caller when an unknown token is sent', async () => {
        const current = await refreshTokenOf();
        const cookie = await loginCookie(ctx.app);

        await patchAccount(cookie, {
          currentPassword: 'my-password',
          newPassword: 'brand-new-password',
          refreshToken: 'not-a-real-token',
        }).expect(200);

        expect(isRevoked(current)).toBe(true);
      });

      it('revokes nothing on a username-only change, even with a refresh token sent', async () => {
        const current = await refreshTokenOf();
        const other = await refreshTokenOf();
        const cookie = await loginCookie(ctx.app);

        await patchAccount(cookie, {
          currentPassword: 'my-password',
          username: 'new-username',
          refreshToken: current,
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
});
