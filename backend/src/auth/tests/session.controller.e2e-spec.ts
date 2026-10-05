import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { loginAs, registerUser, useTestApp } from './auth.controller.e2e-test-support.js';

interface SignedIn {
  cookie: string;
  refreshToken: string;
}

function signedIn(response: request.Response): SignedIn {
  return {
    cookie: response.headers['set-cookie'][0].split(';')[0],
    refreshToken: response.body.refreshToken,
  };
}

function post(app: INestApplication, path: string, session: SignedIn | null, body: object): request.Test {
  const req = request(app.getHttpServer()).post(path);

  return (session ? req.set('Cookie', [session.cookie]) : req).send(body);
}

function listSessions(app: INestApplication, session: SignedIn, refreshToken = session.refreshToken): request.Test {
  return post(app, '/auth/sessions/mine.json', session, { refreshToken });
}

function refreshWith(app: INestApplication, refreshToken: string): request.Test {
  return request(app.getHttpServer()).post('/auth/refresh.json').send({ refreshToken });
}

describe('SessionController (e2e)', () => {
  const ctx = useTestApp({ registerDefaultUser: false });

  let first: SignedIn;
  let second: SignedIn;
  let other: SignedIn;

  beforeEach(async () => {
    first = signedIn(await registerUser(ctx.app, { username: 'darthjee', email: 'darthjee@example.com' }));
    second = signedIn(await loginAs(ctx.app));
    other = signedIn(await registerUser(ctx.app, { username: 'other', email: 'other@example.com' }));
  });

  async function sessionIdOf(session: SignedIn): Promise<string> {
    const response = await listSessions(ctx.app, session);

    return response.body.sessions.find((entry: { current: boolean }) => entry.current).id;
  }

  describe('authentication', () => {
    it.each([
      '/auth/sessions/mine.json',
      '/auth/sessions/revoke-others.json',
      '/auth/sessions/some-uuid/revoke.json',
    ])('rejects an unauthenticated call to %s with 401', async (path) => {
      await post(ctx.app, path, null, { refreshToken: first.refreshToken }).expect(401);
    });
  });

  describe('POST /auth/sessions/mine.json', () => {
    it('lists only the caller\'s active sessions, marking the current one', async () => {
      const response = await listSessions(ctx.app, second).expect(201);
      const { sessions } = response.body;

      expect(sessions).toHaveLength(2);
      expect(sessions.filter((entry: { current: boolean }) => entry.current)).toHaveLength(1);
      expect(sessions[0]).toEqual(expect.objectContaining({
        id: expect.any(String),
        startedAt: expect.any(String),
        keepSignedIn: false,
        current: expect.any(Boolean),
      }));
    });

    it('marks no session as current for an unknown refresh token', async () => {
      const response = await listSessions(ctx.app, first, 'not-a-real-token').expect(201);

      expect(response.body.sessions.map((entry: { current: boolean }) => entry.current)).toEqual([false, false]);
    });

    it('keeps the session id and startedAt across a refresh', async () => {
      const before = (await listSessions(ctx.app, first)).body.sessions
        .find((entry: { current: boolean }) => entry.current);
      const refreshed = await refreshWith(ctx.app, first.refreshToken).expect(201);

      const after = (await listSessions(ctx.app, first, refreshed.body.refreshToken)).body.sessions
        .find((entry: { current: boolean }) => entry.current);

      expect(after.id).toBe(before.id);
      expect(after.startedAt).toBe(before.startedAt);
    });

    it('rejects a missing refreshToken with 400', async () => {
      await post(ctx.app, '/auth/sessions/mine.json', first, {}).expect(400);
    });
  });

  describe('POST /auth/sessions/:uuid/revoke.json', () => {
    it('revokes one of the caller\'s own sessions', async () => {
      const id = await sessionIdOf(second);

      await post(ctx.app, `/auth/sessions/${id}/revoke.json`, first, {})
        .expect(201)
        .expect({ revoked: true });

      await refreshWith(ctx.app, second.refreshToken).expect(401);
    });

    it('allows revoking the current session', async () => {
      const id = await sessionIdOf(first);

      await post(ctx.app, `/auth/sessions/${id}/revoke.json`, first, {}).expect(201);

      await refreshWith(ctx.app, first.refreshToken).expect(401);
    });

    it('answers 404 for another user\'s session, leaving it alive', async () => {
      const id = await sessionIdOf(other);

      await post(ctx.app, `/auth/sessions/${id}/revoke.json`, first, {}).expect(404);

      await refreshWith(ctx.app, other.refreshToken).expect(201);
    });

    it('answers 404 for an unknown session', async () => {
      await post(ctx.app, '/auth/sessions/00000000-0000-4000-8000-000000000000/revoke.json', first, {})
        .expect(404);
    });
  });

  describe('POST /auth/sessions/revoke-others.json', () => {
    it('revokes every session except the current one', async () => {
      await post(ctx.app, '/auth/sessions/revoke-others.json', first, { refreshToken: first.refreshToken })
        .expect(201)
        .expect({ revoked: true });

      const { sessions } = (await listSessions(ctx.app, first)).body;

      expect(sessions).toEqual([expect.objectContaining({ current: true })]);
      await refreshWith(ctx.app, other.refreshToken).expect(201);
      await refreshWith(ctx.app, first.refreshToken).expect(201);
      // Last, since presenting a revoked token revokes the whole token family (replay detection).
      await refreshWith(ctx.app, second.refreshToken).expect(401);
    });

    it.each([
      ['an unknown', (): string => 'not-a-real-token'],
      ['another user\'s', (): string => other.refreshToken],
    ])('answers 401 for %s refresh token and revokes nothing', async (_label, token) => {
      await post(ctx.app, '/auth/sessions/revoke-others.json', first, { refreshToken: token() }).expect(401);

      await refreshWith(ctx.app, first.refreshToken).expect(201);
      await refreshWith(ctx.app, second.refreshToken).expect(201);
      await refreshWith(ctx.app, other.refreshToken).expect(201);
    });

    it('answers 401 for a revoked refresh token and revokes nothing', async () => {
      const refreshed = await refreshWith(ctx.app, first.refreshToken).expect(201);

      await post(ctx.app, '/auth/sessions/revoke-others.json', first, { refreshToken: first.refreshToken })
        .expect(401);

      await refreshWith(ctx.app, refreshed.body.refreshToken).expect(201);
      await refreshWith(ctx.app, second.refreshToken).expect(201);
    });

    it('answers 400 for a missing refresh token and revokes nothing', async () => {
      await post(ctx.app, '/auth/sessions/revoke-others.json', first, {}).expect(400);

      await refreshWith(ctx.app, second.refreshToken).expect(201);
    });
  });

  describe('cache headers', () => {
    it.each([
      ['/auth/sessions/mine.json', 201],
      ['/auth/sessions/revoke-others.json', 201],
      ['/auth/sessions/some-uuid/revoke.json', 404],
    ])('marks %s as never cached', async (path, status) => {
      const response = await post(ctx.app, path, first, { refreshToken: first.refreshToken }).expect(status);

      expect(response.headers['x-skip-cache']).toBe('true');
      expect(response.headers['cache-control']).toBe('no-store');
    });
  });
});
