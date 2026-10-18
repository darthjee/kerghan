import request from 'supertest';
import { loginCookie, registerUser, useTestApp } from './auth.controller.e2e-test-support.js';
import { expectErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { User } from '../entities/user.entity.js';

describe('AdminController (e2e)', () => {
  const ctx = useTestApp({ adminGuard: true, registerDefaultUser: false });

  async function registerAndLogin(username: string, email: string): Promise<string> {
    await registerUser(ctx.app, { username, email });

    return loginCookie(ctx.app, username);
  }

  describe('when the caller is unauthenticated', () => {
    it('rejects users/search.json with 401', async () => {
      await request(ctx.app.getHttpServer()).post('/admin/users/search.json').send({}).expect(401);
    });

    it('rejects recovery-link.json with 401', async () => {
      await request(ctx.app.getHttpServer()).post('/admin/users/1/recovery-link.json').expect(401);
    });

    it('rejects send-recovery-email.json with 401', async () => {
      await request(ctx.app.getHttpServer()).post('/admin/users/1/send-recovery-email.json').expect(401);
    });

    it('rejects edit.json with 401', async () => {
      await request(ctx.app.getHttpServer())
        .post('/admin/users/1/edit.json')
        .send({ username: 'new-username' })
        .expect(401);
    });

    it.each(['approve.json', 'deny.json'])('rejects %s with 401', async (action) => {
      await request(ctx.app.getHttpServer()).post(`/admin/users/1/${action}`).send({}).expect(401);
    });
  });

  describe('when the caller is authenticated but not an admin', () => {
    let cookie: string;

    beforeEach(async () => {
      cookie = await registerAndLogin('darthjee', 'darthjee@example.com');
    });

    it('rejects users/search.json with 403 FORBIDDEN', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/admin/users/search.json')
        .set('Cookie', [cookie])
        .send({});

      expectErrorBody(response, { status: 403, code: ErrorCodes.FORBIDDEN, message: 'Admin access required' });
    });

    it('rejects recovery-link.json with 403', async () => {
      await request(ctx.app.getHttpServer())
        .post('/admin/users/1/recovery-link.json')
        .set('Cookie', [cookie])
        .expect(403);
    });

    it('rejects send-recovery-email.json with 403', async () => {
      await request(ctx.app.getHttpServer())
        .post('/admin/users/1/send-recovery-email.json')
        .set('Cookie', [cookie])
        .expect(403);
    });

    it('rejects edit.json with 403', async () => {
      await request(ctx.app.getHttpServer())
        .post('/admin/users/1/edit.json')
        .set('Cookie', [cookie])
        .send({ username: 'new-username' })
        .expect(403);
    });

    it.each(['approve.json', 'deny.json'])('rejects %s with 403 FORBIDDEN, changing nothing', async (action) => {
      await registerUser(ctx.app, { username: 'luke', email: 'luke@example.com' });
      const target = ctx.userRepo.rows.find((row) => row.username === 'luke')!;
      target.status = 'pending';

      const response = await request(ctx.app.getHttpServer())
        .post(`/admin/users/${target.id}/${action}`)
        .set('Cookie', [cookie])
        .send({});

      expectErrorBody(response, { status: 403, code: ErrorCodes.FORBIDDEN, message: 'Admin access required' });
      expect(target.status).toBe('pending');
    });
  });

  describe('when the caller is an admin', () => {
    let adminCookie: string;
    let targetUserId: number;

    beforeEach(async () => {
      await registerUser(ctx.app, { username: 'darthjee', email: 'darthjee@example.com' });
      targetUserId = ctx.userRepo.rows[0].id as number;

      await registerUser(ctx.app, { username: 'obi-wan', email: 'obi-wan@example.com' });
      const adminRow = ctx.userRepo.rows.find((row) => row.username === 'obi-wan')!;
      adminRow.isAdmin = true;

      adminCookie = await loginCookie(ctx.app, 'obi-wan');
    });

    const post = (path: string, body: object = {}): request.Test =>
      request(ctx.app.getHttpServer()).post(path).set('Cookie', [adminCookie]).send(body);

    describe('POST /admin/users/search.json', () => {
      describe('when q is omitted', () => {
        let response: request.Response;

        beforeEach(async () => {
          response = await request(ctx.app.getHttpServer())
            .post('/admin/users/search.json')
            .set('Cookie', [adminCookie])
            .send({})
            .expect(201);
        });

        it('returns every user', () => {
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

        it('sets the X-Skip-Cache header', () => {
          expect(response.headers['x-skip-cache']).toBe('true');
        });
      });

      it('filters by q against username/email', async () => {
        const response = await request(ctx.app.getHttpServer())
          .post('/admin/users/search.json')
          .set('Cookie', [adminCookie])
          .send({ q: 'darth' })
          .expect(201);

        expect(response.body.users).toHaveLength(1);
        expect(response.body.users[0]).toEqual(expect.objectContaining({ username: 'darthjee' }));
      });

      describe('with a status filter', () => {
        beforeEach(() => {
          ctx.userRepo.rows.find((row) => row.id === targetUserId)!.status = 'pending';
        });

        it('returns only users in that status', async () => {
          const response = await request(ctx.app.getHttpServer())
            .post('/admin/users/search.json')
            .set('Cookie', [adminCookie])
            .send({ status: 'pending' })
            .expect(201);

          expect(response.body.users).toEqual([
            expect.objectContaining({ id: targetUserId, status: 'pending' }),
          ]);
        });

        it('combines the status filter with q (AND)', async () => {
          const matching = await request(ctx.app.getHttpServer())
            .post('/admin/users/search.json')
            .set('Cookie', [adminCookie])
            .send({ q: 'darth', status: 'pending' })
            .expect(201);
          const notMatching = await request(ctx.app.getHttpServer())
            .post('/admin/users/search.json')
            .set('Cookie', [adminCookie])
            .send({ q: 'obi', status: 'pending' })
            .expect(201);

          expect(matching.body.users).toEqual([expect.objectContaining({ username: 'darthjee' })]);
          expect(notMatching.body.users).toEqual([]);
        });
      });

      it('rejects an unknown status with 400 VALIDATION_FAILED', async () => {
        const response = await request(ctx.app.getHttpServer())
          .post('/admin/users/search.json')
          .set('Cookie', [adminCookie])
          .send({ status: 'banned' });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe(ErrorCodes.VALIDATION_FAILED);
      });

      describe('the response shape', () => {
        let response: request.Response;

        beforeEach(async () => {
          response = await request(ctx.app.getHttpServer())
            .post('/admin/users/search.json')
            .set('Cookie', [adminCookie])
            .send({})
            .expect(201);
        });

        it('carries each user\'s status and no secret fields', () => {
          response.body.users.forEach((user: Record<string, unknown>) => {
            expect(Object.keys(user).sort()).toEqual(
              ['createdAt', 'email', 'id', 'isAdmin', 'status', 'username'],
            );
          });
        });

        it('returns the calling admin\'s id as currentUserId', () => {
          const adminRow = ctx.userRepo.rows.find((row) => row.username === 'obi-wan')!;

          expect(response.body.currentUserId).toBe(adminRow.id);
        });
      });
    });

    describe('POST /admin/users/:id/approve.json', () => {
      let target: User;

      beforeEach(() => {
        target = ctx.userRepo.rows.find((row) => row.id === targetUserId)!;
      });

      describe('for a pending user', () => {
        let targetCookie: string;
        let response: request.Response;

        beforeEach(async () => {
          targetCookie = await loginCookie(ctx.app, 'darthjee');
          target.status = 'pending';

          response = await post(`/admin/users/${targetUserId}/approve.json`).expect(200);
        });

        it('approves the user and returns the user item', () => {
          expect(response.body).toEqual({
            user: {
              id: targetUserId,
              username: 'darthjee',
              email: 'darthjee@example.com',
              isAdmin: false,
              createdAt: expect.any(String),
              status: 'approved',
            },
          });
          expect(target.status).toBe('approved');
        });

        it('sets the X-Skip-Cache header', () => {
          expect(response.headers['x-skip-cache']).toBe('true');
        });

        it('lets the user\'s existing session through the gate on its next request', async () => {
          await request(ctx.app.getHttpServer()).get('/protected').set('Cookie', [targetCookie]).expect(200);
        });
      });

      it.each(['approved', 'denied'] as const)(
        'answers 422 USER_NOT_PENDING for a %s user, changing nothing',
        async (status) => {
          target.status = status;

          const response = await post(`/admin/users/${targetUserId}/approve.json`);

          expect(response.status).toBe(422);
          expect(response.body.error.code).toBe(ErrorCodes.USER_NOT_PENDING);
          expect(target.status).toBe(status);
        },
      );

      it('responds 404 for an unknown user id', async () => {
        await post('/admin/users/999999/approve.json').expect(404);
      });
    });

    describe('POST /admin/users/:id/deny.json', () => {
      let target: User;

      beforeEach(() => {
        target = ctx.userRepo.rows.find((row) => row.id === targetUserId)!;
      });

      it.each(['pending', 'approved', 'denied'] as const)(
        'denies a %s user and returns the user item',
        async (status) => {
          target.status = status;

          const response = await post(`/admin/users/${targetUserId}/deny.json`).expect(200);

          expect(response.body).toEqual({
            user: expect.objectContaining({ id: targetUserId, username: 'darthjee', status: 'denied' }),
          });
          expect(response.headers['x-skip-cache']).toBe('true');
          expect(target.status).toBe('denied');
        },
      );

      describe('for a signed-in user', () => {
        let targetCookie: string;

        beforeEach(async () => {
          targetCookie = await loginCookie(ctx.app, 'darthjee');
        });

        it('revokes every active refresh token with admin_denied, keeping earlier reasons', async () => {
          const targetTokens = ctx.refreshTokenRepo.rows.filter((row) => row.userId === targetUserId);
          const [alreadyRevoked] = targetTokens;
          const revokedAt = new Date(Date.now() - 60_000);
          alreadyRevoked.revokedAt = revokedAt;
          alreadyRevoked.revokedReason = 'logout';

          await post(`/admin/users/${targetUserId}/deny.json`).expect(200);

          expect(targetTokens.length).toBeGreaterThan(1);
          expect(alreadyRevoked).toEqual(expect.objectContaining({ revokedAt, revokedReason: 'logout' }));
          targetTokens.slice(1).forEach((row) => {
            expect(row).toEqual(expect.objectContaining({ revokedAt: expect.any(Date), revokedReason: 'admin_denied' }));
          });
        });

        it('leaves other users\' refresh tokens untouched', async () => {
          await post(`/admin/users/${targetUserId}/deny.json`).expect(200);

          ctx.refreshTokenRepo.rows
            .filter((row) => row.userId !== targetUserId)
            .forEach((row) => expect(row.revokedAt).toBeFalsy());
        });

        it('answers 401 on the denied user\'s next request', async () => {
          await post(`/admin/users/${targetUserId}/deny.json`).expect(200);

          await request(ctx.app.getHttpServer()).get('/protected').set('Cookie', [targetCookie]).expect(401);
        });
      });

      it('answers 422 CANNOT_DENY_SELF for the caller\'s own account, changing nothing', async () => {
        const adminRow = ctx.userRepo.rows.find((row) => row.username === 'obi-wan')!;

        const response = await post(`/admin/users/${adminRow.id}/deny.json`);

        expect(response.status).toBe(422);
        expect(response.body.error.code).toBe(ErrorCodes.CANNOT_DENY_SELF);
        expect(adminRow.status).toBe('approved');
        expect(ctx.refreshTokenRepo.rows.filter((row) => row.userId === adminRow.id && row.revokedAt)).toEqual([]);
      });

      it('responds 404 for an unknown user id', async () => {
        await post('/admin/users/999999/deny.json').expect(404);
      });
    });

    describe('other admin routes on a denied user', () => {
      let target: User;

      beforeEach(() => {
        target = ctx.userRepo.rows.find((row) => row.id === targetUserId)!;
        target.status = 'denied';
      });

      it.each([
        ['edit.json', { username: 'darthjee-renamed' }],
        ['recovery-link.json', {}],
        ['send-recovery-email.json', {}],
      ])('%s behaves as for any user and leaves the status denied', async (action, body) => {
        await post(`/admin/users/${targetUserId}/${action}`, body).expect(201);

        expect(target.status).toBe('denied');
      });
    });

    describe('POST /admin/users/:id/recovery-link.json', () => {
      describe('for an existing user', () => {
        let response: request.Response;

        beforeEach(async () => {
          response = await request(ctx.app.getHttpServer())
            .post(`/admin/users/${targetUserId}/recovery-link.json`)
            .set('Cookie', [adminCookie])
            .expect(201);
        });

        it('mints a fresh recovery link', () => {
          expect(response.body).toEqual({
            resetUrl: expect.stringMatching(/\/#\/recover-password\?token=.+$/),
          });
        });

        it('sets the X-Skip-Cache header', () => {
          expect(response.headers['x-skip-cache']).toBe('true');
        });
      });

      it('responds 404 for an unknown user id', async () => {
        await request(ctx.app.getHttpServer())
          .post('/admin/users/999999/recovery-link.json')
          .set('Cookie', [adminCookie])
          .expect(404);
      });
    });

    describe('POST /admin/users/:id/send-recovery-email.json', () => {
      describe('for an existing user', () => {
        let response: request.Response;

        beforeEach(async () => {
          response = await request(ctx.app.getHttpServer())
            .post(`/admin/users/${targetUserId}/send-recovery-email.json`)
            .set('Cookie', [adminCookie])
            .expect(201);
        });

        it('responds with a sent boolean', () => {
          expect(response.body).toEqual({ sent: expect.any(Boolean) });
        });

        it('sets the X-Skip-Cache header', () => {
          expect(response.headers['x-skip-cache']).toBe('true');
        });
      });

      it('responds 404 for an unknown user id', async () => {
        await request(ctx.app.getHttpServer())
          .post('/admin/users/999999/send-recovery-email.json')
          .set('Cookie', [adminCookie])
          .expect(404);
      });
    });

    describe('POST /admin/users/:id/edit.json', () => {
      describe('for an existing user', () => {
        let response: request.Response;

        beforeEach(async () => {
          response = await request(ctx.app.getHttpServer())
            .post(`/admin/users/${targetUserId}/edit.json`)
            .set('Cookie', [adminCookie])
            .send({
              username: 'darthjee-renamed',
              email: 'darthjee-renamed@example.com',
              newPassword: 'brand-new-password',
            })
            .expect(201);
        });

        it('updates the username, email, and password', () => {
          expect(response.body).toEqual({
            user: expect.objectContaining({
              id: targetUserId,
              username: 'darthjee-renamed',
              email: 'darthjee-renamed@example.com',
              isAdmin: false,
              createdAt: expect.any(String),
              status: 'approved',
            }),
          });
        });

        it('sets the X-Skip-Cache header', () => {
          expect(response.headers['x-skip-cache']).toBe('true');
        });
      });

      it('never changes the user\'s status', async () => {
        const target = ctx.userRepo.rows.find((row) => row.id === targetUserId)!;
        target.status = 'denied';

        await request(ctx.app.getHttpServer())
          .post(`/admin/users/${targetUserId}/edit.json`)
          .set('Cookie', [adminCookie])
          .send({ username: 'darthjee-renamed', newPassword: 'brand-new-password' })
          .expect(201);

        expect(target.status).toBe('denied');
      });

      it('responds 404 for an unknown user id', async () => {
        await request(ctx.app.getHttpServer())
          .post('/admin/users/999999/edit.json')
          .set('Cookie', [adminCookie])
          .send({ username: 'new-username' })
          .expect(404);
      });

      it('responds 400 without applying changes when no field is given', async () => {
        await request(ctx.app.getHttpServer())
          .post(`/admin/users/${targetUserId}/edit.json`)
          .set('Cookie', [adminCookie])
          .send({})
          .expect(400);
      });

      it('responds 400 (not a raw 500) when newPassword is shorter than 8 characters', async () => {
        await request(ctx.app.getHttpServer())
          .post(`/admin/users/${targetUserId}/edit.json`)
          .set('Cookie', [adminCookie])
          .send({ newPassword: 'short' })
          .expect(400);
      });
    });
  });
});
