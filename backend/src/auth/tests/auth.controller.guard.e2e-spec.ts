import request from 'supertest';
import { loginCookie, useTestApp } from './auth.controller.e2e-test-support.js';

describe('AuthController (e2e)', () => {
  const ctx = useTestApp();

  describe('JwtGuard', () => {
    it('allows a public route through without a token', async () => {
      await request(ctx.app.getHttpServer()).get('/public').expect(200);
    });

    it('rejects a protected route with no access token', async () => {
      await request(ctx.app.getHttpServer()).get('/protected').expect(401);
    });

    it('rejects a protected route with an invalid access token', async () => {
      await request(ctx.app.getHttpServer())
        .get('/protected')
        .set('Cookie', ['access_token=not-a-valid-jwt'])
        .expect(401);
    });

    it('allows a protected route with a valid access token', async () => {
      const accessTokenCookie = await loginCookie(ctx.app);

      await request(ctx.app.getHttpServer())
        .get('/protected')
        .set('Cookie', [accessTokenCookie])
        .expect(200, { ok: true });
    });
  });
});
