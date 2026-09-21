import request from 'supertest';
import { loginAs, loginCookie, useTestApp } from './auth.controller.e2e-test-support.js';

describe('AuthController (e2e)', () => {
  const ctx = useTestApp();

  describe('PATCH /auth/account.json', () => {
    it('rejects an unauthenticated request', async () => {
      await request(ctx.app.getHttpServer())
        .patch('/auth/account.json')
        .send({ currentPassword: 'my-password', username: 'new-username' })
        .expect(401);
    });

    it('updates the username and responds with { username, email }', async () => {
      const cookie = await loginCookie(ctx.app);

      const response = await request(ctx.app.getHttpServer())
        .patch('/auth/account.json')
        .set('Cookie', [cookie])
        .send({ currentPassword: 'my-password', username: 'new-username' })
        .expect(200);

      expect(response.body).toEqual({ username: 'new-username', email: 'darthjee@example.com' });
    });

    it('sets the X-Skip-Cache header', async () => {
      const cookie = await loginCookie(ctx.app);

      const response = await request(ctx.app.getHttpServer())
        .patch('/auth/account.json')
        .set('Cookie', [cookie])
        .send({ currentPassword: 'my-password', username: 'new-username' })
        .expect(200);

      expect(response.headers['x-skip-cache']).toBe('true');
    });

    it('rejects the wrong current password without changing the account', async () => {
      const cookie = await loginCookie(ctx.app);

      await request(ctx.app.getHttpServer())
        .patch('/auth/account.json')
        .set('Cookie', [cookie])
        .send({ currentPassword: 'wrong-password', username: 'new-username' })
        .expect(400);

      expect(ctx.userRepo.rows[0].username).toBe('darthjee');
    });

    it('does not revoke the caller\'s other refresh tokens on a successful password change', async () => {
      const login = await loginAs(ctx.app);
      const accessTokenCookie = login.headers['set-cookie'][0].split(';')[0];

      await request(ctx.app.getHttpServer())
        .patch('/auth/account.json')
        .set('Cookie', [accessTokenCookie])
        .send({ currentPassword: 'my-password', newPassword: 'brand-new-password' })
        .expect(200);

      await request(ctx.app.getHttpServer())
        .post('/auth/refresh.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(201);
    });

    it(
      'locks the account out with 423 after 5 failed attempts, even with the right password',
      async () => {
        const cookie = await loginCookie(ctx.app);

        for (let i = 0; i < 5; i += 1) {
          await request(ctx.app.getHttpServer())
            .patch('/auth/account.json')
            .set('Cookie', [cookie])
            .send({ currentPassword: 'wrong-password', username: 'new-username' })
            .expect(400);
        }

        await request(ctx.app.getHttpServer())
          .patch('/auth/account.json')
          .set('Cookie', [cookie])
          .send({ currentPassword: 'my-password', username: 'new-username' })
          .expect(423);
      },
      15000,
    );
  });
});
