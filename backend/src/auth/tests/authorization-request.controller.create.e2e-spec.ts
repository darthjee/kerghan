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

  describe('create', () => {
    it('returns { uuid, pollToken, expiresAt } for a matching username', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/authorization-requests.json')
        .send({ username: 'darthjee' })
        .expect(201);

      expect(response.body).toEqual({
        uuid: expect.any(String),
        pollToken: expect.any(String),
        expiresAt: expect.any(String),
      });
    });

    it('returns the same shape for a non-matching username', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/authorization-requests.json')
        .send({ username: 'nobody' })
        .expect(201);

      expect(response.body).toEqual({
        uuid: expect.any(String),
        pollToken: expect.any(String),
        expiresAt: expect.any(String),
      });
    });

    it('sets the X-Skip-Cache header', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/authorization-requests.json')
        .send({ username: 'darthjee' })
        .expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
    });
  });
});
