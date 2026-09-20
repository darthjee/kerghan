import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, createInMemoryRepo } from './auth.controller.e2e-test-support.js';
import { User } from '../entities/user.entity.js';

describe('AdminController (e2e)', () => {
  let app: INestApplication;
  let userRepo: ReturnType<typeof createInMemoryRepo<User>>;

  async function registerAndLogin(username: string, email: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/auth/register.json')
      .send({ username, email, password: 'my-password' });

    const login = await request(app.getHttpServer())
      .post('/auth/login.json')
      .send({ username, password: 'my-password' });

    return login.headers['set-cookie'][0].split(';')[0];
  }

  beforeEach(async () => {
    ({ app, userRepo } = await buildTestApp({ adminGuard: true, registerDefaultUser: false }));
  });

  afterEach(async () => {
    await app.close();
  });

  describe('when the caller is unauthenticated', () => {
    it('rejects users/search.json with 401', async () => {
      await request(app.getHttpServer()).post('/admin/users/search.json').send({}).expect(401);
    });

    it('rejects recovery-link.json with 401', async () => {
      await request(app.getHttpServer()).post('/admin/users/1/recovery-link.json').expect(401);
    });

    it('rejects send-recovery-email.json with 401', async () => {
      await request(app.getHttpServer()).post('/admin/users/1/send-recovery-email.json').expect(401);
    });

    it('rejects edit.json with 401', async () => {
      await request(app.getHttpServer())
        .post('/admin/users/1/edit.json')
        .send({ username: 'new-username' })
        .expect(401);
    });
  });

  describe('when the caller is authenticated but not an admin', () => {
    let cookie: string;

    beforeEach(async () => {
      cookie = await registerAndLogin('darthjee', 'darthjee@example.com');
    });

    it('rejects users/search.json with 403', async () => {
      await request(app.getHttpServer())
        .post('/admin/users/search.json')
        .set('Cookie', [cookie])
        .send({})
        .expect(403);
    });

    it('rejects recovery-link.json with 403', async () => {
      await request(app.getHttpServer())
        .post('/admin/users/1/recovery-link.json')
        .set('Cookie', [cookie])
        .expect(403);
    });

    it('rejects send-recovery-email.json with 403', async () => {
      await request(app.getHttpServer())
        .post('/admin/users/1/send-recovery-email.json')
        .set('Cookie', [cookie])
        .expect(403);
    });

    it('rejects edit.json with 403', async () => {
      await request(app.getHttpServer())
        .post('/admin/users/1/edit.json')
        .set('Cookie', [cookie])
        .send({ username: 'new-username' })
        .expect(403);
    });
  });

  describe('when the caller is an admin', () => {
    let adminCookie: string;
    let targetUserId: number;

    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/auth/register.json')
        .send({ username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' });
      targetUserId = userRepo.rows[0].id as number;

      await request(app.getHttpServer())
        .post('/auth/register.json')
        .send({ username: 'obi-wan', email: 'obi-wan@example.com', password: 'my-password' });
      const adminRow = userRepo.rows.find((row) => row.username === 'obi-wan')!;
      adminRow.isAdmin = true;

      const login = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'obi-wan', password: 'my-password' });
      adminCookie = login.headers['set-cookie'][0].split(';')[0];
    });

    describe('POST /admin/users/search.json', () => {
      it('returns every user when q is omitted', async () => {
        const response = await request(app.getHttpServer())
          .post('/admin/users/search.json')
          .set('Cookie', [adminCookie])
          .send({})
          .expect(201);

        expect(response.body.users).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: targetUserId,
              username: 'darthjee',
              email: 'darthjee@example.com',
              isAdmin: false,
              createdAt: expect.any(String),
            }),
          ]),
        );
      });

      it('filters by q against username/email', async () => {
        const response = await request(app.getHttpServer())
          .post('/admin/users/search.json')
          .set('Cookie', [adminCookie])
          .send({ q: 'darth' })
          .expect(201);

        expect(response.body.users).toHaveLength(1);
        expect(response.body.users[0]).toEqual(expect.objectContaining({ username: 'darthjee' }));
      });

      it('sets the X-Skip-Cache header', async () => {
        const response = await request(app.getHttpServer())
          .post('/admin/users/search.json')
          .set('Cookie', [adminCookie])
          .send({})
          .expect(201);

        expect(response.headers['x-skip-cache']).toBe('true');
      });
    });

    describe('POST /admin/users/:id/recovery-link.json', () => {
      it('mints a fresh recovery link for an existing user', async () => {
        const response = await request(app.getHttpServer())
          .post(`/admin/users/${targetUserId}/recovery-link.json`)
          .set('Cookie', [adminCookie])
          .expect(201);

        expect(response.body).toEqual({
          resetUrl: expect.stringMatching(/\/#\/recover-password\?token=.+$/),
        });
      });

      it('sets the X-Skip-Cache header', async () => {
        const response = await request(app.getHttpServer())
          .post(`/admin/users/${targetUserId}/recovery-link.json`)
          .set('Cookie', [adminCookie])
          .expect(201);

        expect(response.headers['x-skip-cache']).toBe('true');
      });

      it('responds 404 for an unknown user id', async () => {
        await request(app.getHttpServer())
          .post('/admin/users/999999/recovery-link.json')
          .set('Cookie', [adminCookie])
          .expect(404);
      });
    });

    describe('POST /admin/users/:id/send-recovery-email.json', () => {
      it('responds with a sent boolean for an existing user', async () => {
        const response = await request(app.getHttpServer())
          .post(`/admin/users/${targetUserId}/send-recovery-email.json`)
          .set('Cookie', [adminCookie])
          .expect(201);

        expect(response.body).toEqual({ sent: expect.any(Boolean) });
      });

      it('sets the X-Skip-Cache header', async () => {
        const response = await request(app.getHttpServer())
          .post(`/admin/users/${targetUserId}/send-recovery-email.json`)
          .set('Cookie', [adminCookie])
          .expect(201);

        expect(response.headers['x-skip-cache']).toBe('true');
      });

      it('responds 404 for an unknown user id', async () => {
        await request(app.getHttpServer())
          .post('/admin/users/999999/send-recovery-email.json')
          .set('Cookie', [adminCookie])
          .expect(404);
      });
    });

    describe('POST /admin/users/:id/edit.json', () => {
      it('updates the username, email, and password for an existing user', async () => {
        const response = await request(app.getHttpServer())
          .post(`/admin/users/${targetUserId}/edit.json`)
          .set('Cookie', [adminCookie])
          .send({
            username: 'darthjee-renamed',
            email: 'darthjee-renamed@example.com',
            newPassword: 'brand-new-password',
          })
          .expect(201);

        expect(response.body).toEqual({
          user: expect.objectContaining({
            id: targetUserId,
            username: 'darthjee-renamed',
            email: 'darthjee-renamed@example.com',
            isAdmin: false,
            createdAt: expect.any(String),
          }),
        });
      });

      it('sets the X-Skip-Cache header', async () => {
        const response = await request(app.getHttpServer())
          .post(`/admin/users/${targetUserId}/edit.json`)
          .set('Cookie', [adminCookie])
          .send({ username: 'darthjee-renamed' })
          .expect(201);

        expect(response.headers['x-skip-cache']).toBe('true');
      });

      it('responds 404 for an unknown user id', async () => {
        await request(app.getHttpServer())
          .post('/admin/users/999999/edit.json')
          .set('Cookie', [adminCookie])
          .send({ username: 'new-username' })
          .expect(404);
      });

      it('responds 400 without applying changes when no field is given', async () => {
        await request(app.getHttpServer())
          .post(`/admin/users/${targetUserId}/edit.json`)
          .set('Cookie', [adminCookie])
          .send({})
          .expect(400);
      });

      it('responds 400 (not a raw 500) when newPassword is shorter than 8 characters', async () => {
        await request(app.getHttpServer())
          .post(`/admin/users/${targetUserId}/edit.json`)
          .set('Cookie', [adminCookie])
          .send({ newPassword: 'short' })
          .expect(400);
      });
    });
  });
});
