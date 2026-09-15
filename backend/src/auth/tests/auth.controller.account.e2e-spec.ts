import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, createInMemoryRepo } from './auth.controller.e2e-test-support.js';
import { User } from '../entities/user.entity.js';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let userRepo: ReturnType<typeof createInMemoryRepo<User>>;

  beforeEach(async () => {
    ({ app, userRepo } = await buildTestApp());
  });

  afterEach(async () => {
    await app.close();
  });

  describe('PATCH /auth/account.json', () => {
    async function loginCookie(): Promise<string> {
      const login = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'my-password' });

      return login.headers['set-cookie'][0].split(';')[0];
    }

    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer())
        .patch('/auth/account.json')
        .send({ currentPassword: 'my-password', username: 'new-username' })
        .expect(401);
    });

    it('updates the username and responds with { username, email }', async () => {
      const cookie = await loginCookie();

      const response = await request(app.getHttpServer())
        .patch('/auth/account.json')
        .set('Cookie', [cookie])
        .send({ currentPassword: 'my-password', username: 'new-username' })
        .expect(200);

      expect(response.body).toEqual({ username: 'new-username', email: 'darthjee@example.com' });
    });

    it('sets the X-Skip-Cache header', async () => {
      const cookie = await loginCookie();

      const response = await request(app.getHttpServer())
        .patch('/auth/account.json')
        .set('Cookie', [cookie])
        .send({ currentPassword: 'my-password', username: 'new-username' })
        .expect(200);

      expect(response.headers['x-skip-cache']).toBe('true');
    });

    it('rejects the wrong current password without changing the account', async () => {
      const cookie = await loginCookie();

      await request(app.getHttpServer())
        .patch('/auth/account.json')
        .set('Cookie', [cookie])
        .send({ currentPassword: 'wrong-password', username: 'new-username' })
        .expect(400);

      expect(userRepo.rows[0].username).toBe('darthjee');
    });

    it('does not revoke the caller\'s other refresh tokens on a successful password change', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'my-password' });
      const accessTokenCookie = login.headers['set-cookie'][0].split(';')[0];

      await request(app.getHttpServer())
        .patch('/auth/account.json')
        .set('Cookie', [accessTokenCookie])
        .send({ currentPassword: 'my-password', newPassword: 'brand-new-password' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/refresh.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(201);
    });

    it(
      'locks the account out with 423 after 5 failed attempts, even with the right password',
      async () => {
        const cookie = await loginCookie();

        for (let i = 0; i < 5; i += 1) {
          await request(app.getHttpServer())
            .patch('/auth/account.json')
            .set('Cookie', [cookie])
            .send({ currentPassword: 'wrong-password', username: 'new-username' })
            .expect(400);
        }

        await request(app.getHttpServer())
          .patch('/auth/account.json')
          .set('Cookie', [cookie])
          .send({ currentPassword: 'my-password', username: 'new-username' })
          .expect(423);
      },
      15000,
    );
  });
});
