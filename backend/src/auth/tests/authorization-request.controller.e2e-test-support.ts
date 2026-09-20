import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthorizationRequest } from '../entities/authorization-request.entity.js';
import { User } from '../entities/user.entity.js';
import { buildAuthTestApp } from './support/build-auth-test-app.js';
import { createInMemoryRepo, matchesCondition } from './support/in-memory-repo.js';

export { createInMemoryRepo, matchesCondition };

// Builds a fresh app instance wired the same way as the outer `beforeEach` via `buildAuthTestApp()`,
// optionally overriding `ConfigService#get` with `configOverrides` — used by the
// rate-limiting/abuse-hardening tests below to exercise non-default limits without env-var plumbing.
export async function buildTestApp(configOverrides: Record<string, string> = {}): Promise<{
  app: INestApplication;
  userRepo: ReturnType<typeof createInMemoryRepo<User>>;
  authorizationRequestRepo: ReturnType<typeof createInMemoryRepo<AuthorizationRequest>>;
}> {
  const { app, userRepo, authorizationRequestRepo } = await buildAuthTestApp({ configOverrides });

  return { app, userRepo, authorizationRequestRepo };
}

// Raises an authorization request for `username` against `app` and returns its `uuid`/`pollToken`.
export async function createAuthorizationRequest(
  app: INestApplication,
  username = 'darthjee',
): Promise<{ uuid: string; pollToken: string }> {
  const response = await request(app.getHttpServer())
    .post('/auth/authorization-requests.json')
    .send({ username })
    .expect(201);

  return response.body;
}

// Logs `username` in against `app` and returns the `access_token` cookie (`name=value`) to replay
// via `.set('Cookie', [cookie])`.
export async function login(app: INestApplication, username: string, password: string): Promise<string> {
  const response = await request(app.getHttpServer()).post('/auth/login.json').send({ username, password });
  return response.headers['set-cookie'][0].split(';')[0];
}
