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

  describe('JwtGuard', () => {
    it('allows a public route through without a token', async () => {
      await request(app.getHttpServer()).get('/public').expect(200);
    });

    it('rejects a protected route with no access token', async () => {
      await request(app.getHttpServer()).get('/protected').expect(401);
    });

    it('rejects a protected route with an invalid access token', async () => {
      await request(app.getHttpServer())
        .get('/protected')
        .set('Cookie', ['access_token=not-a-valid-jwt'])
        .expect(401);
    });

    it('allows a protected route with a valid access token', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login.json')
        .send({ username: 'darthjee', password: 'my-password' });
      const accessTokenCookie = login.headers['set-cookie'][0].split(';')[0];

      await request(app.getHttpServer())
        .get('/protected')
        .set('Cookie', [accessTokenCookie])
        .expect(200, { ok: true });
    });
  });
});
