import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthorizationRequest } from '../entities/authorization-request.entity.js';
import { buildTestApp, createInMemoryRepo } from './authorization-request.controller.e2e-test-support.js';

describe('AuthorizationRequestController (e2e)', () => {
  let app: INestApplication;
  let authorizationRequestRepo: ReturnType<typeof createInMemoryRepo<AuthorizationRequest>>;

  beforeEach(async () => {
    ({ app, authorizationRequestRepo } = await buildTestApp());
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

  function approve(uuid: string): void {
    const row = authorizationRequestRepo.rows.find((candidate) => candidate.uuid === uuid);

    if (row) {
      row.status = 'approved';
    }
  }

  describe('full poll flow', () => {
    it('goes open -> approved (Set-Cookie + refreshToken) -> logged (no credentials)', async () => {
      const { uuid, pollToken } = await createAuthorizationRequest();

      const openResponse = await request(app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);

      expect(openResponse.body).toEqual({ status: 'open' });

      approve(uuid);

      const approvedResponse = await request(app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);

      expect(approvedResponse.body).toEqual({
        status: 'approved',
        user: { id: expect.any(Number), username: 'darthjee', email: 'darthjee@example.com', isAdmin: false },
        refreshToken: expect.any(String),
      });
      expect(approvedResponse.headers['set-cookie'][0]).toMatch(/^access_token=/);

      const loggedResponse = await request(app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);

      expect(loggedResponse.body).toEqual({ status: 'logged' });
      expect(loggedResponse.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('expiry path', () => {
    it('flips an overdue open request to expired', async () => {
      const { uuid, pollToken } = await createAuthorizationRequest();
      const row = authorizationRequestRepo.rows.find((candidate) => candidate.uuid === uuid);
      row!.expiresAt = new Date(Date.now() - 1000);

      const response = await request(app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);

      expect(response.body).toEqual({ status: 'expired' });
    });
  });

  describe('wrong poll token', () => {
    it('returns 404, indistinguishable from an unknown uuid', async () => {
      const { uuid } = await createAuthorizationRequest();

      await request(app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken: 'wrong-token' })
        .expect(404);
    });

    it('returns 404 for an unknown uuid', async () => {
      await request(app.getHttpServer())
        .post('/auth/authorization-requests/not-a-real-uuid/poll.json')
        .send({ pollToken: 'whatever' })
        .expect(404);
    });
  });

  describe('concurrent post-approval polls', () => {
    it('grants credentials to exactly one of two simultaneous polls', async () => {
      const { uuid, pollToken } = await createAuthorizationRequest();
      approve(uuid);

      const [first, second] = await Promise.all([
        request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/poll.json`)
          .send({ pollToken }),
        request(app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/poll.json`)
          .send({ pollToken }),
      ]);

      const statuses = [first.body.status, second.body.status].sort();

      expect(statuses).toEqual(['approved', 'logged']);
    });
  });

  describe('X-Skip-Cache header', () => {
    it('is set on every poll response', async () => {
      const { uuid, pollToken } = await createAuthorizationRequest();

      const response = await request(app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
    });
  });
});
