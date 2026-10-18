import request from 'supertest';
import { createAuthorizationRequest, useTestApp } from './authorization-request.controller.e2e-test-support.js';
import { findSetCookie } from './support/auth-requests.js';
import { expectErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';

describe('AuthorizationRequestController (e2e)', () => {
  const ctx = useTestApp();

  function approve(uuid: string): void {
    const row = ctx.authorizationRequestRepo.rows.find((candidate) => candidate.uuid === uuid);

    if (row) {
      row.status = 'approved';
    }
  }

  describe('full poll flow', () => {
    it('goes open -> approved (session cookies + user) -> logged (no credentials)', async () => {
      const { uuid, pollToken } = await createAuthorizationRequest(ctx.app);

      const openResponse = await request(ctx.app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);

      expect(openResponse.body).toEqual({ status: 'open' });

      approve(uuid);

      const approvedResponse = await request(ctx.app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);

      expect(approvedResponse.body).toEqual({
        status: 'approved',
        user: { id: expect.any(Number), username: 'darthjee', email: 'darthjee@example.com', isAdmin: false },
      });
      expect(findSetCookie(approvedResponse, 'access_token')).toMatch(/^access_token=[^;]+;/);
      expect(findSetCookie(approvedResponse, 'refresh_token')).toMatch(/^refresh_token=[^;]+;.*Path=\/auth;.*HttpOnly/);
      expect(findSetCookie(approvedResponse, 'logged_in')).toMatch(/^logged_in=1;/);

      const loggedResponse = await request(ctx.app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);

      expect(loggedResponse.body).toEqual({ status: 'logged' });
      expect(loggedResponse.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('user no longer approved', () => {
    function poll(uuid: string, pollToken: string): request.Test {
      return request(ctx.app.getHttpServer()).post(`/auth/authorization-requests/${uuid}/poll.json`).send({ pollToken });
    }

    function requestStatus(uuid: string): string | undefined {
      return ctx.authorizationRequestRepo.rows.find((row) => row.uuid === uuid)?.status;
    }

    it('answers { status: "denied" } with no cookies when the user turned pending before the poll', async () => {
      const { uuid, pollToken } = await createAuthorizationRequest(ctx.app);

      approve(uuid);
      ctx.userRepo.rows[0].status = 'pending';

      const response = await poll(uuid, pollToken).expect(201);

      expect(response.body).toEqual({ status: 'denied' });
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(requestStatus(uuid)).toBe('denied');
    });

    it('answers { status: "denied" } when the user is denied after the claim, before the mint', async () => {
      const { uuid, pollToken } = await createAuthorizationRequest(ctx.app);
      const findOneBy = ctx.userRepo.findOneBy.bind(ctx.userRepo);

      approve(uuid);
      jest.spyOn(ctx.userRepo, 'findOneBy').mockImplementation(async (where) => {
        expect(requestStatus(uuid)).toBe('logged');
        ctx.userRepo.rows[0].status = 'denied';

        return findOneBy(where);
      });

      const response = await poll(uuid, pollToken).expect(201);

      expect(response.body).toEqual({ status: 'denied' });
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(requestStatus(uuid)).toBe('denied');
      expect(await poll(uuid, pollToken).expect(201)).toHaveProperty('body', { status: 'denied' });
    });
  });

  describe('expiry path', () => {
    it('flips an overdue open request to expired', async () => {
      const { uuid, pollToken } = await createAuthorizationRequest(ctx.app);
      const row = ctx.authorizationRequestRepo.rows.find((candidate) => candidate.uuid === uuid);
      row!.expiresAt = new Date(Date.now() - 1000);

      const response = await request(ctx.app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);

      expect(response.body).toEqual({ status: 'expired' });
    });
  });

  describe('wrong poll token', () => {
    it('returns 404, indistinguishable from an unknown uuid', async () => {
      const { uuid } = await createAuthorizationRequest(ctx.app);

      const response = await request(ctx.app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken: 'wrong-token' });

      expectErrorBody(response, {
        status: 404,
        code: ErrorCodes.NOT_FOUND,
        message: 'Authorization request not found',
      });
    });

    it('returns 404 NOT_FOUND for an unknown uuid', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/auth/authorization-requests/not-a-real-uuid/poll.json')
        .send({ pollToken: 'whatever' });

      expectErrorBody(response, {
        status: 404,
        code: ErrorCodes.NOT_FOUND,
        message: 'Authorization request not found',
      });
    });
  });

  describe('concurrent post-approval polls', () => {
    it('grants credentials to exactly one of two simultaneous polls', async () => {
      const { uuid, pollToken } = await createAuthorizationRequest(ctx.app);
      approve(uuid);

      const [first, second] = await Promise.all([
        request(ctx.app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/poll.json`)
          .send({ pollToken }),
        request(ctx.app.getHttpServer())
          .post(`/auth/authorization-requests/${uuid}/poll.json`)
          .send({ pollToken }),
      ]);

      const statuses = [first.body.status, second.body.status].sort();

      expect(statuses).toEqual(['approved', 'logged']);
    });
  });

  describe('X-Skip-Cache header', () => {
    it('is set on every poll response', async () => {
      const { uuid, pollToken } = await createAuthorizationRequest(ctx.app);

      const response = await request(ctx.app.getHttpServer())
        .post(`/auth/authorization-requests/${uuid}/poll.json`)
        .send({ pollToken })
        .expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
    });
  });
});
