import request from 'supertest';
import { User } from '../entities/user.entity.js';
import {
  accessCookieFor,
  ENABLED_DEFAULT_USER,
  expectDefaultUserManagedBody,
  seedUser,
  useDefaultUserApp,
} from './support/default-user-e2e.js';

describe('AdminController default user (e2e)', () => {
  const seedOtherAdmin = async ({ userRepo }: { userRepo: Parameters<typeof seedUser>[0] }): Promise<void> => {
    await seedUser(userRepo, { username: 'root', email: 'root@example.com', password: 'my-password', isAdmin: true });
    await seedUser(userRepo, { username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' });
  };

  describe('with the feature enabled', () => {
    const ctx = useDefaultUserApp({ defaultUserSettings: ENABLED_DEFAULT_USER, beforeInit: seedOtherAdmin });

    const userId = (username: string): number =>
      (ctx.userRepo.rows.find((row) => row.username === username) as User).id;

    const post = (cookie: string, path: string, body: Record<string, string> = {}): request.Test =>
      request(ctx.app.getHttpServer()).post(path).set('Cookie', [cookie]).send(body);

    describe('as another admin', () => {
      let cookie: string;

      beforeEach(async () => {
        cookie = await accessCookieFor(ctx.app, 'root', 'my-password');
      });

      it.each([
        ['username', { username: 'renamed' }],
        ['email', { email: 'renamed@example.com' }],
        ['newPassword', { newPassword: 'a-brand-new-password' }],
      ])('answers 409 to edit.json with %s, changing nothing', async (_field, changes) => {
        const before = { ...ctx.userRepo.rows.find((row) => row.username === 'admin') };

        expectDefaultUserManagedBody(await post(cookie, `/admin/users/${userId('admin')}/edit.json`, changes));
        expect(ctx.userRepo.rows.find((row) => row.id === before.id)).toEqual(before);
      });

      it('answers 409 to edit.json when the values equal the stored ones', async () => {
        const response = await post(cookie, `/admin/users/${userId('admin')}/edit.json`, {
          username: 'admin',
          email: 'admin@kerghan.local',
        });

        expectDefaultUserManagedBody(response);
      });

      it('answers 409 to recovery-link.json, creating no token', async () => {
        expectDefaultUserManagedBody(await post(cookie, `/admin/users/${userId('admin')}/recovery-link.json`));
        expect(ctx.passwordResetTokenRepo.rows).toHaveLength(0);
      });

      it('answers 409 to send-recovery-email.json, creating no token', async () => {
        expectDefaultUserManagedBody(await post(cookie, `/admin/users/${userId('admin')}/send-recovery-email.json`));
        expect(ctx.passwordResetTokenRepo.rows).toHaveLength(0);
      });

      it.each(['edit.json', 'recovery-link.json', 'send-recovery-email.json'])(
        'still answers 404 to %s for an unknown id',
        async (action) => {
          await post(cookie, `/admin/users/9999/${action}`, { username: 'x' }).expect(404);
        },
      );

      it('still edits other users', async () => {
        await post(cookie, `/admin/users/${userId('darthjee')}/edit.json`, { username: 'renamed' }).expect(201);
      });

      it('answers 409 to deny.json, changing nothing and revoking no token', async () => {
        await accessCookieFor(ctx.app, 'admin');
        const defaultUser = ctx.userRepo.rows.find((row) => row.username === 'admin') as User;
        const statusBefore = defaultUser.status;

        expectDefaultUserManagedBody(await post(cookie, `/admin/users/${defaultUser.id}/deny.json`));
        expect(defaultUser.status).toBe(statusBefore);
        expect(ctx.refreshTokenRepo.rows.filter((row) => row.userId === defaultUser.id)).not.toHaveLength(0);
        expect(ctx.refreshTokenRepo.rows.filter((row) => row.revokedAt)).toEqual([]);
      });

      it('still answers 404 to deny.json for an unknown id', async () => {
        await post(cookie, '/admin/users/9999/deny.json').expect(404);
      });

      it('still denies other users', async () => {
        await post(cookie, `/admin/users/${userId('darthjee')}/deny.json`).expect(200);
        expect(ctx.userRepo.rows.find((row) => row.username === 'darthjee')!.status).toBe('denied');
      });

      it('still mints recovery links for other users', async () => {
        await post(cookie, `/admin/users/${userId('darthjee')}/recovery-link.json`).expect(201);
        expect(ctx.passwordResetTokenRepo.rows).toHaveLength(1);
      });
    });

    it('answers 409 (not 422) when the default user denies itself', async () => {
      const cookie = await accessCookieFor(ctx.app, 'admin');

      expectDefaultUserManagedBody(await post(cookie, `/admin/users/${userId('admin')}/deny.json`));
    });

    it('blocks the default user editing itself as an admin', async () => {
      const cookie = await accessCookieFor(ctx.app, 'admin');

      expectDefaultUserManagedBody(await post(cookie, `/admin/users/${userId('admin')}/edit.json`, { username: 'x' }));
    });
  });

  describe('with the feature disabled after an earlier enabled boot', () => {
    const ctx = useDefaultUserApp({
      defaultUserSettings: { ...ENABLED_DEFAULT_USER, enabled: false },
      beforeInit: async (repos) => {
        await seedOtherAdmin(repos);
        await seedUser(repos.userRepo, { username: 'admin', email: 'admin@kerghan.local', isAdmin: true });
      },
    });

    it('edits and mints recovery links for the former default user as usual', async () => {
      const cookie = await accessCookieFor(ctx.app, 'root', 'my-password');
      const id = (ctx.userRepo.rows.find((row) => row.username === 'admin') as User).id;
      const server = ctx.app.getHttpServer();

      await request(server).post(`/admin/users/${id}/edit.json`).set('Cookie', [cookie]).send({ username: 'renamed' })
        .expect(201);
      await request(server).post(`/admin/users/${id}/recovery-link.json`).set('Cookie', [cookie]).expect(201);
    });
  });
});
