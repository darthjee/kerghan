import request from 'supertest';
import { expectUniformCreateResponse, useTestApp } from './authorization-request.controller.e2e-test-support.js';

describe('AuthorizationRequestController (e2e)', () => {
  const ctx = useTestApp();

  describe('create', () => {
    it('returns { uuid, pollToken, expiresAt } for a matching username', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/auth/authorization-requests.json')
        .send({ username: 'darthjee' })
        .expect(201);

      expectUniformCreateResponse(response.body);
    });

    it('returns the same shape for a non-matching username', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/auth/authorization-requests.json')
        .send({ username: 'nobody' })
        .expect(201);

      expectUniformCreateResponse(response.body);
    });

    it('accepts keepSignedIn: true, storing it and keeping the response shape', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/auth/authorization-requests.json')
        .send({ username: 'darthjee', keepSignedIn: true })
        .expect(201);

      expectUniformCreateResponse(response.body);
      expect(ctx.authorizationRequestRepo.rows[0].keepSignedIn).toBe(true);
    });

    it('accepts an omitted keepSignedIn, storing false', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/authorization-requests.json')
        .send({ username: 'darthjee' })
        .expect(201);

      expect(ctx.authorizationRequestRepo.rows[0].keepSignedIn).toBe(false);
    });

    it.each([['the string "true"', 'true'], ['the number 1', 1]])(
      'rejects keepSignedIn as %s with 400',
      async (_label, value) => {
        await request(ctx.app.getHttpServer())
          .post('/auth/authorization-requests.json')
          .send({ username: 'darthjee', keepSignedIn: value })
          .expect(400);
      },
    );

    it('sets the X-Skip-Cache header', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/auth/authorization-requests.json')
        .send({ username: 'darthjee' })
        .expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
    });
  });
});
