import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { User } from '../entities/user.entity.js';
import { PasswordResetService } from '../password-reset.service.js';
import {
  accessCookieFor,
  DEFAULT_PASSWORD,
  ENABLED_DEFAULT_USER,
  expectDefaultUserManagedBody,
  seedUser,
  useDefaultUserApp,
  useInsensitiveUsernameCollation,
} from './support/default-user-e2e.js';

describe('AuthController default user (e2e)', () => {
  function patchAccount(app: INestApplication, cookie: string, body: Record<string, string>): request.Test {
    return request(app.getHttpServer()).patch('/auth/account.json').set('Cookie', [cookie]).send(body);
  }

  describe('with the feature enabled', () => {
    const ctx = useDefaultUserApp({
      defaultUserSettings: ENABLED_DEFAULT_USER,
      beforeInit: async ({ userRepo }) => {
        await seedUser(userRepo, { username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' });
      },
    });

    const defaultUser = (): User => ctx.userRepo.rows.find((row) => row.username === 'admin') as User;

    it('creates the default user at boot', async () => {
      expect(defaultUser()).toMatchObject({ email: 'admin@kerghan.local', isAdmin: true });
      await expect(bcrypt.compare(DEFAULT_PASSWORD, defaultUser().passwordDigest)).resolves.toBe(true);
    });

    describe('PATCH /auth/account.json as the default user', () => {
      let cookie: string;

      beforeEach(async () => {
        cookie = await accessCookieFor(ctx.app, 'admin');
      });

      it.each([
        ['username', { username: 'renamed' }],
        ['email', { email: 'renamed@example.com' }],
        ['newPassword', { newPassword: 'a-brand-new-password' }],
      ])('answers 409 DEFAULT_USER_MANAGED for %s and changes nothing', async (_field, changes) => {
        const before = { ...defaultUser() };
        const response = await patchAccount(ctx.app, cookie, { currentPassword: DEFAULT_PASSWORD, ...changes });

        expectDefaultUserManagedBody(response);
        expect(defaultUser()).toEqual(before);
      });

      it('answers 409 when the values equal the stored ones', async () => {
        const response = await patchAccount(ctx.app, cookie, {
          currentPassword: DEFAULT_PASSWORD,
          username: 'admin',
          email: 'admin@kerghan.local',
        });

        expectDefaultUserManagedBody(response);
      });

      it('answers 409 with a wrong currentPassword and counts no failure', async () => {
        const response = await patchAccount(ctx.app, cookie, { currentPassword: 'wrong-password', username: 'x' });

        expectDefaultUserManagedBody(response);
        expect(ctx.accountEditLockoutRepo.rows).toHaveLength(0);
      });

      it('answers 409, not 423, when locked out, leaving the lockout row untouched', async () => {
        const lockedUntil = new Date(Date.now() + 60_000);
        ctx.accountEditLockoutRepo.rows.push({ id: 1, userId: defaultUser().id, failedAttempts: 5, lockedUntil } as never);

        const response = await patchAccount(ctx.app, cookie, { currentPassword: DEFAULT_PASSWORD, username: 'x' });

        expectDefaultUserManagedBody(response);
        expect(ctx.accountEditLockoutRepo.rows[0]).toMatchObject({ failedAttempts: 5, lockedUntil });
      });

      it('still answers 400 when no field is present', async () => {
        await patchAccount(ctx.app, cookie, { currentPassword: DEFAULT_PASSWORD }).expect(400);
      });
    });

    it('lets other users edit their account', async () => {
      const cookie = await accessCookieFor(ctx.app, 'darthjee', 'my-password');

      await patchAccount(ctx.app, cookie, { currentPassword: 'my-password', username: 'renamed' }).expect(200);
    });

    describe('POST /auth/recover.json', () => {
      it('answers 200 { sent: true } for the default user email, creating no token', async () => {
        const response = await request(ctx.app.getHttpServer())
          .post('/auth/recover.json')
          .send({ email: 'admin@kerghan.local' })
          .expect(200);

        expect(response.body).toEqual({ sent: true });
        expect(ctx.passwordResetTokenRepo.rows).toHaveLength(0);
      });

      it('still creates a token for other users', async () => {
        await request(ctx.app.getHttpServer()).post('/auth/recover.json').send({ email: 'darthjee@example.com' });

        expect(ctx.passwordResetTokenRepo.rows).toHaveLength(1);
      });
    });

    describe('POST /auth/reset-password.json', () => {
      it('answers 409 for a valid default-user token, keeping the password and the token', async () => {
        const digest = defaultUser().passwordDigest;
        const { token } = await ctx.app.get(PasswordResetService).issueToken(defaultUser());

        const response = await request(ctx.app.getHttpServer())
          .post('/auth/reset-password.json')
          .send({ token, password: 'a-brand-new-password' });

        expectDefaultUserManagedBody(response);
        expect(defaultUser().passwordDigest).toBe(digest);
        expect(ctx.passwordResetTokenRepo.rows[0].usedAt).toBeNull();
      });

      it('keeps the 400 for an unknown token', async () => {
        await request(ctx.app.getHttpServer())
          .post('/auth/reset-password.json')
          .send({ token: 'unknown', password: 'a-brand-new-password' })
          .expect(400);
      });
    });
  });

  describe('when the stored username differs in case/accents from the configured one', () => {
    const ctx = useDefaultUserApp({
      defaultUserSettings: ENABLED_DEFAULT_USER,
      beforeInit: async ({ userRepo }) => {
        useInsensitiveUsernameCollation(userRepo);
        await seedUser(userRepo, { username: 'ÁDMIN', email: 'old@example.com', password: 'an-old-password' });
      },
    });

    it('matches the stored row at boot and blocks it by id', async () => {
      expect(ctx.userRepo.rows).toHaveLength(1);
      const cookie = await accessCookieFor(ctx.app, 'ÁDMIN');

      const response = await patchAccount(ctx.app, cookie, { currentPassword: DEFAULT_PASSWORD, username: 'renamed' });

      expectDefaultUserManagedBody(response);
      expect(ctx.userRepo.rows[0]).toMatchObject({ username: 'ÁDMIN', email: 'admin@kerghan.local' });
    });
  });

  describe('with the feature disabled after an earlier enabled boot', () => {
    const ctx = useDefaultUserApp({
      defaultUserSettings: { ...ENABLED_DEFAULT_USER, enabled: false },
      beforeInit: async ({ userRepo }) => {
        await seedUser(userRepo, { username: 'admin', email: 'admin@kerghan.local', isAdmin: true });
      },
    });

    it('lets the former default user edit its account', async () => {
      const cookie = await accessCookieFor(ctx.app, 'admin');

      await patchAccount(ctx.app, cookie, { currentPassword: DEFAULT_PASSWORD, username: 'renamed' }).expect(200);
    });

    it('lets the former default user recover and reset its password', async () => {
      await request(ctx.app.getHttpServer()).post('/auth/recover.json').send({ email: 'admin@kerghan.local' });
      expect(ctx.passwordResetTokenRepo.rows).toHaveLength(1);

      const { token } = await ctx.app.get(PasswordResetService).issueToken(ctx.userRepo.rows[0]);

      await request(ctx.app.getHttpServer())
        .post('/auth/reset-password.json')
        .send({ token, password: 'a-brand-new-password' })
        .expect(200);
    });
  });
});
