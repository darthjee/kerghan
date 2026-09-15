import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp } from './authorization-request.controller.e2e-test-support.js';

describe('AuthorizationRequestController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    ({ app } = await buildTestApp());
  });

  afterEach(async () => {
    await app.close();
  });

  async function createAuthorizationRequest(username = 'darthjee'): Promise<{ uuid: string; pollToken: string }> {
    const response = await request(app.getHttpServer())
      .post('/auth/authorization-requests.json')
      .send({ username })
      .expect(201);

    return response.body;
  }

  describe('approver routes', () => {
    let ownerCookie: string;
    let attackerCookie: string;

    async function login(username: string, password: string): Promise<string> {
      const response = await request(app.getHttpServer()).post('/auth/login.json').send({ username, password });
      return response.headers['set-cookie'][0].split(';')[0];
    }

    beforeEach(async () => {
      ownerCookie = await login('darthjee', 'my-password');

      await request(app.getHttpServer())
        .post('/auth/register.json')
        .send({ username: 'vader', email: 'vader@example.com', password: 'attacker-password' });
      attackerCookie = await login('vader', 'attacker-password');
    });

    describe('mine', () => {
      it('rejects an unauthenticated call with 401', async () => {
        await request(app.getHttpServer()).post('/auth/authorization-requests/mine.json').send({}).expect(401);
      });

      it("returns only the caller's own open, non-expired requests, newest first", async () => {
        const { uuid } = await createAuthorizationRequest('darthjee');

        const response = await request(app.getHttpServer())
          .post('/auth/authorization-requests/mine.json')
          .set('Cookie', [ownerCookie])
          .send({})
          .expect(201);

        expect(response.body).toEqual({
          requests: [
            {
              uuid,
              requestIp: expect.any(String),
              requestUserAgent: expect.any(String),
              createdAt: expect.any(String),
              expiresAt: expect.any(String),
            },
          ],
        });
      });

      it("never returns a request raised against another user's username", async () => {
        await createAuthorizationRequest('vader');

        const response = await request(app.getHttpServer())
          .post('/auth/authorization-requests/mine.json')
          .set('Cookie', [ownerCookie])
          .send({})
          .expect(201);

        expect(response.body).toEqual({ requests: [] });
      });

      it('never returns a request with userId: null (unresolved username)', async () => {
        await createAuthorizationRequest('nobody');

        const response = await request(app.getHttpServer())
          .post('/auth/authorization-requests/mine.json')
          .set('Cookie', [ownerCookie])
          .send({})
          .expect(201);

        expect(response.body).toEqual({ requests: [] });
      });
    });

    describe('authorize', () => {
      it('rejects an unauthenticated call with 401', async () => {
        const { uuid } = await createAuthorizationRequest('darthjee');

        await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/authorize.json`)
          .send({ password: 'my-password' })
          .expect(401);
      });

      it('rejects a wrong password with 400', async () => {
        const { uuid } = await createAuthorizationRequest('darthjee');

        await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/authorize.json`)
          .set('Cookie', [ownerCookie])
          .send({ password: 'wrong-password' })
          .expect(400);
      });

      it("rejects the attacker authorizing the owner's request with 400", async () => {
        const { uuid } = await createAuthorizationRequest('darthjee');

        await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/authorize.json`)
          .set('Cookie', [attackerCookie])
          .send({ password: 'attacker-password' })
          .expect(400);
      });

      it('authorizes on the correct password, and a subsequent poll grants credentials exactly once', async () => {
        const { uuid, pollToken } = await createAuthorizationRequest('darthjee');

        const response = await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/authorize.json`)
          .set('Cookie', [ownerCookie])
          .send({ password: 'my-password' })
          .expect(201);

        expect(response.body).toEqual({ authorized: true });

        const approvedPoll = await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/poll.json`)
          .send({ pollToken })
          .expect(201);

        expect(approvedPoll.body).toEqual({
          status: 'approved',
          user: { id: expect.any(Number), username: 'darthjee', email: 'darthjee@example.com', isAdmin: false },
          refreshToken: expect.any(String),
        });

        const secondPoll = await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/poll.json`)
          .send({ pollToken })
          .expect(201);

        expect(secondPoll.body).toEqual({ status: 'logged' });
      });
    });

    describe('deny', () => {
      it('rejects an unauthenticated call with 401', async () => {
        const { uuid } = await createAuthorizationRequest('darthjee');

        await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/deny.json`)
          .send({})
          .expect(401);
      });

      it("rejects the attacker denying the owner's request with 400", async () => {
        const { uuid } = await createAuthorizationRequest('darthjee');

        await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/deny.json`)
          .set('Cookie', [attackerCookie])
          .send({})
          .expect(400);
      });

      it('denies on the owner call, and a subsequent poll returns { status: "denied" }', async () => {
        const { uuid, pollToken } = await createAuthorizationRequest('darthjee');

        const response = await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/deny.json`)
          .set('Cookie', [ownerCookie])
          .send({})
          .expect(201);

        expect(response.body).toEqual({ denied: true });

        const pollResponse = await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/poll.json`)
          .send({ pollToken })
          .expect(201);

        expect(pollResponse.body).toEqual({ status: 'denied' });
      });
    });

    describe('X-Skip-Cache header', () => {
      it('is set on the mine response', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/authorization-requests/mine.json')
          .set('Cookie', [ownerCookie])
          .send({})
          .expect(201);

        expect(response.headers['x-skip-cache']).toBe('true');
      });

      it('is set on the authorize response', async () => {
        const { uuid } = await createAuthorizationRequest('darthjee');

        const response = await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/authorize.json`)
          .set('Cookie', [ownerCookie])
          .send({ password: 'my-password' })
          .expect(201);

        expect(response.headers['x-skip-cache']).toBe('true');
      });

      it('is set on the deny response', async () => {
        const { uuid } = await createAuthorizationRequest('darthjee');

        const response = await request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/deny.json`)
          .set('Cookie', [ownerCookie])
          .send({})
          .expect(201);

        expect(response.headers['x-skip-cache']).toBe('true');
      });
    });
  });
});
