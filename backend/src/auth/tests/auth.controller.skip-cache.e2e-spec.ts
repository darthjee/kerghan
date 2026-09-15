import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp } from './auth.controller.e2e-test-support.js';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    ({ app } = await buildTestApp());
  });

  afterEach(async () => {
    await app.close();
  });

  describe('X-Skip-Cache header', () => {
    it('is set on the login response, so Tent never caches it across users', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'my-password' })
        .expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
    });

    it('is set on the register response', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register.json')
        .send({ username: 'obi-wan', email: 'obi-wan@example.com', password: 'another-password' })
        .expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
    });

    it('is set on the refresh response', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'my-password' });

      const response = await request(app.getHttpServer())
        .post('/auth/refresh.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
    });

    it('is set on the logout response', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'my-password' });

      const response = await request(app.getHttpServer())
        .delete('/auth/logoff.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(204);

      expect(response.headers['x-skip-cache']).toBe('true');
    });
  });
});
