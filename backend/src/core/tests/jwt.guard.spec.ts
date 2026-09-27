import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtGuard } from '../jwt.guard.js';

const CURRENT_KEY = 'current-key';
const PAYLOAD = { sub: 42, username: 'darthjee', isAdmin: false };

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

function buildGuard(env: Record<string, string>): JwtGuard {
  const jwtService = new JwtService({ secret: CURRENT_KEY });
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
  const configService = { get: jest.fn((key: string) => env[key]) };

  return new JwtGuard(
    jwtService,
    reflector as unknown as Reflector,
    configService as unknown as ConfigService,
  );
}

function sign(secret: string, expiresIn: number = 60): string {
  return new JwtService({ secret }).sign(PAYLOAD, { expiresIn });
}

function expired(secret: string): string {
  const past = Math.floor(Date.now() / 1000) - 3600;
  return new JwtService({ secret }).sign({ ...PAYLOAD, iat: past, exp: past + 60 });
}

function run(guard: JwtGuard, token?: string): { result: boolean; request: Record<string, unknown> } {
  const request: Record<string, unknown> = { cookies: token ? { access_token: token } : {} };
  const result = guard.canActivate(contextFor(request));
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

    it('accepts a token signed with the current key', () => {
      const { result, request } = run(guard, sign(CURRENT_KEY));

      expect(result).toBe(true);
      expect(request.user).toMatchObject(PAYLOAD);
    });

    it.each(['old-key-1', 'old-key-2'])('accepts a token signed with previous key %s', (key) => {
      const { result, request } = run(guard, sign(key));

      expect(result).toBe(true);
      expect(request.user).toMatchObject(PAYLOAD);
    });

    it('rejects a token signed with an unknown key', () => {
      expect(() => run(guard, sign('unknown-key'))).toThrow(INVALID);
    });

    it('rejects an expired token signed with a previous key', () => {
      expect(() => run(guard, expired('old-key-1'))).toThrow(INVALID);
    });

    it('rejects an expired token signed with the current key', () => {
      expect(() => run(guard, expired(CURRENT_KEY))).toThrow(INVALID);
    });

    it('rejects a malformed token', () => {
      expect(() => run(guard, 'not-a-jwt')).toThrow(INVALID);
    });
  });

  describe('without previous keys configured', () => {
    let guard: JwtGuard;

    beforeEach(() => {
      guard = buildGuard({ KERGHAN_SECRET_KEY: CURRENT_KEY });
    });

    it('accepts a token signed with the current key', () => {
      const { result, request } = run(guard, sign(CURRENT_KEY));

      expect(result).toBe(true);
      expect(request.user).toMatchObject(PAYLOAD);
    });

    it('rejects a token signed with any other key', () => {
      expect(() => run(guard, sign('old-key-1'))).toThrow(INVALID);
    });

    it('rejects a request without an access token', () => {
      expect(() => run(guard)).toThrow(new UnauthorizedException('Missing access token'));
    });
  });

  describe('on a @Public() route', () => {
    it('allows the request without verifying anything', () => {
      const jwtService = new JwtService({ secret: CURRENT_KEY });
      const verify = jest.spyOn(jwtService, 'verify');
      const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
      const configService = { get: jest.fn() };
      const guard = new JwtGuard(
        jwtService,
        reflector as unknown as Reflector,
        configService as unknown as ConfigService,
      );

      expect(guard.canActivate(contextFor({ cookies: {} }))).toBe(true);
      expect(verify).not.toHaveBeenCalled();
    });
  });
});
