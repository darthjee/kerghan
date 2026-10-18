import { createHmac } from 'crypto';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtGuard } from '../jwt.guard.js';
import type { SessionLookup, SessionUser } from '../session-lookup.js';

const CURRENT_KEY = 'current-key';
const SID = '1b4e28ba-2fa1-4d2e-8f3a-9c1d2e3f4a5b';
const PAYLOAD = { sub: 42, sid: SID, username: 'darthjee', isAdmin: false };
const SESSION_USER: SessionUser = { id: 42, username: 'darthjee', isAdmin: false };

// Default `SessionLookup` double: knows only the `SID` session, owned by user 42.
function sessionLookupDouble(): SessionLookup & { findActiveSessionUser: jest.Mock } {
  return {
    findActiveSessionUser: jest.fn(async (sid: string) => (sid === SID ? SESSION_USER : null)),
  };
}

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

function buildGuard(
  env: Record<string, string>,
  jwtSecret: string | undefined = CURRENT_KEY,
  sessionLookup: SessionLookup = sessionLookupDouble(),
): JwtGuard {
  const jwtService = new JwtService({ secret: jwtSecret });
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
  const configService = { get: jest.fn((key: string) => env[key]) };

  return new JwtGuard(
    jwtService,
    reflector as unknown as Reflector,
    configService as unknown as ConfigService,
    sessionLookup,
  );
}

function sign(secret: string, expiresIn: number = 60): string {
  return new JwtService({ secret }).sign(PAYLOAD, { expiresIn });
}

function expired(secret: string): string {
  const past = Math.floor(Date.now() / 1000) - 3600;
  return new JwtService({ secret }).sign({ ...PAYLOAD, iat: past, exp: past + 60 });
}

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function claims(): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return { ...PAYLOAD, iat: now, exp: now + 60 };
}

// Hand-built so the library's own signing safeguards can't mask the check.
function unsigned(): string {
  return `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url(claims())}.`;
}

// HS256 token whose HMAC key is the empty string, built by hand because
// jsonwebtoken refuses to sign with an empty secret.
function signedWithEmptySecret(): string {
  const unsignedPart = `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(claims())}`;
  const signature = createHmac('sha256', '').update(unsignedPart).digest('base64url');
  return `${unsignedPart}.${signature}`;
}

async function run(guard: JwtGuard, token?: string): Promise<{ result: boolean; request: Record<string, unknown> }> {
  const request: Record<string, unknown> = { cookies: token ? { access_token: token } : {} };
  const result = await guard.canActivate(contextFor(request));
  return { result, request };
}

const INVALID = new UnauthorizedException('Invalid or expired access token');

describe('JwtGuard', () => {
  describe('with previous keys configured', () => {
    let guard: JwtGuard;

    beforeEach(() => {
      guard = buildGuard({
        KERGHAN_SECRET_KEY: CURRENT_KEY,
        KERGHAN_PREVIOUS_SECRET_KEYS: 'old-key-1, old-key-2',
      });
    });

    it('accepts a token signed with the current key', async () => {
      const { result, request } = await run(guard, sign(CURRENT_KEY));

      expect(result).toBe(true);
      expect(request.user).toMatchObject(PAYLOAD);
    });

    it.each(['old-key-1', 'old-key-2'])('accepts a token signed with previous key %s', async (key) => {
      const { result, request } = await run(guard, sign(key));

      expect(result).toBe(true);
      expect(request.user).toMatchObject(PAYLOAD);
    });

    it('rejects a token signed with an unknown key', async () => {
      await expect(run(guard, sign('unknown-key'))).rejects.toThrow(INVALID);
    });

    it('rejects an expired token signed with a previous key', async () => {
      await expect(run(guard, expired('old-key-1'))).rejects.toThrow(INVALID);
    });

    it('rejects an expired token signed with the current key', async () => {
      await expect(run(guard, expired(CURRENT_KEY))).rejects.toThrow(INVALID);
    });

    it('rejects a malformed token', async () => {
      await expect(run(guard, 'not-a-jwt')).rejects.toThrow(INVALID);
    });

    it('rejects an unsigned alg:none token', async () => {
      await expect(run(guard, unsigned())).rejects.toThrow(INVALID);
    });

    it('rejects an HS256 token signed with an empty-string secret', async () => {
      await expect(run(guard, signedWithEmptySecret())).rejects.toThrow(INVALID);
    });
  });

  describe('without previous keys configured', () => {
    let guard: JwtGuard;

    beforeEach(() => {
      guard = buildGuard({ KERGHAN_SECRET_KEY: CURRENT_KEY });
    });

    it('accepts a token signed with the current key', async () => {
      const { result, request } = await run(guard, sign(CURRENT_KEY));

      expect(result).toBe(true);
      expect(request.user).toMatchObject(PAYLOAD);
    });

    it('rejects a token signed with any other key', async () => {
      await expect(run(guard, sign('old-key-1'))).rejects.toThrow(INVALID);
    });

    it('rejects a request without an access token', async () => {
      await expect(run(guard)).rejects.toThrow(new UnauthorizedException('Missing access token'));
    });
  });

  describe.each([
    ['an empty-string', ''],
    ['an undefined', undefined],
  ])('with an empty KERGHAN_SECRET_KEY and %s JwtService secret', (_label, jwtSecret) => {
    let guard: JwtGuard;

    beforeEach(() => {
      guard = buildGuard({ KERGHAN_SECRET_KEY: '' }, jwtSecret);
    });

    it('rejects a token signed with some other key', async () => {
      await expect(run(guard, sign('some-other-key'))).rejects.toThrow(INVALID);
    });

    it('rejects an unsigned alg:none token', async () => {
      await expect(run(guard, unsigned())).rejects.toThrow(INVALID);
    });

    it('rejects an HS256 token signed with an empty-string secret', async () => {
      await expect(run(guard, signedWithEmptySecret())).rejects.toThrow(INVALID);
    });
  });

  describe('on a @Public() route', () => {
    it('allows the request without verifying anything', async () => {
      const jwtService = new JwtService({ secret: CURRENT_KEY });
      const verify = jest.spyOn(jwtService, 'verify');
      const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
      const configService = { get: jest.fn() };
      const guard = new JwtGuard(
        jwtService,
        reflector as unknown as Reflector,
        configService as unknown as ConfigService,
        sessionLookupDouble(),
      );

      await expect(guard.canActivate(contextFor({ cookies: {} }))).resolves.toBe(true);
      expect(verify).not.toHaveBeenCalled();
    });
  });
});

describe('JwtGuard session gate', () => {
  const OTHER_SID = '6f9619ff-8b86-4d01-b42d-00c04fc964ff';

  let sessionLookup: ReturnType<typeof sessionLookupDouble>;
  let guard: JwtGuard;

  function signClaims(claims: Record<string, unknown>): string {
    return new JwtService({ secret: CURRENT_KEY }).sign(claims, { expiresIn: 60 });
  }

  beforeEach(() => {
    sessionLookup = sessionLookupDouble();
    guard = buildGuard({ KERGHAN_SECRET_KEY: CURRENT_KEY }, CURRENT_KEY, sessionLookup);
  });

  it('looks the session up by the token\'s sid', async () => {
    await run(guard, sign(CURRENT_KEY));

    expect(sessionLookup.findActiveSessionUser).toHaveBeenCalledWith(SID);
  });

  it('builds request.user from the looked-up user, not the token claims', async () => {
    sessionLookup.findActiveSessionUser.mockResolvedValue({ id: 42, username: 'renamed', isAdmin: true });

    const { request } = await run(guard, signClaims({ ...PAYLOAD, username: 'stale', isAdmin: false }));

    expect(request.user).toEqual({ sub: 42, sid: SID, username: 'renamed', isAdmin: true });
  });

  it('rejects a token whose session is not active', async () => {
    await expect(run(guard, signClaims({ ...PAYLOAD, sid: OTHER_SID }))).rejects.toThrow(INVALID);
  });

  it('rejects a token whose session belongs to another user', async () => {
    sessionLookup.findActiveSessionUser.mockResolvedValue({ id: 7, username: 'other', isAdmin: false });

    await expect(run(guard, sign(CURRENT_KEY))).rejects.toThrow(INVALID);
  });

  it.each([
    ['without sid', { sub: 42, username: 'darthjee', isAdmin: false }],
    ['with a numeric sid', { ...PAYLOAD, sid: 12345 }],
    ['with an object sid', { ...PAYLOAD, sid: { $ne: null } }],
    ['with a non-UUID sid', { ...PAYLOAD, sid: 'not-a-uuid' }],
    ['with a UUID-prefixed sid', { ...PAYLOAD, sid: `${SID}' OR 1=1` }],
    ['with a string sub', { ...PAYLOAD, sub: '42' }],
    ['with a non-integer sub', { ...PAYLOAD, sub: 42.5 }],
    ['without sub', { sid: SID, username: 'darthjee', isAdmin: false }],
  ])('rejects a validly signed token %s without looking anything up', async (_label, claims) => {
    await expect(run(guard, signClaims(claims))).rejects.toThrow(INVALID);
    expect(sessionLookup.findActiveSessionUser).not.toHaveBeenCalled();
  });

  it('answers every gate rejection with the exact invalid-token message', async () => {
    const rejection = await run(guard, signClaims({ ...PAYLOAD, sid: OTHER_SID })).catch((error: unknown) => error);

    expect(rejection).toBeInstanceOf(UnauthorizedException);
    expect((rejection as UnauthorizedException).getResponse()).toEqual(INVALID.getResponse());
  });

  it('propagates a lookup error instead of answering 401', async () => {
    const failure = new Error('db down');

    sessionLookup.findActiveSessionUser.mockRejectedValue(failure);

    await expect(run(guard, sign(CURRENT_KEY))).rejects.toBe(failure);
  });
});
