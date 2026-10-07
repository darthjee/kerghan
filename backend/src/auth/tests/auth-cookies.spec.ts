import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { clearSessionCookies, readRefreshToken, resolveRefreshToken, setSessionCookies } from '../auth-cookies.js';
import type { AuthResult } from '../token.service.js';

function responseMock(): { cookie: jest.Mock; clearCookie: jest.Mock } {
  return { cookie: jest.fn(), clearCookie: jest.fn() };
}

function requestWith(cookies?: Record<string, unknown>): Request {
  return { cookies } as unknown as Request;
}

describe('auth-cookies', () => {
  describe('setSessionCookies', () => {
    const configService = { get: jest.fn((_key: string, fallback: number) => fallback) };
    const ttl = 30 * 24 * 60 * 60 * 1000;
    let res: ReturnType<typeof responseMock>;

    beforeEach(() => {
      jest.useFakeTimers({ now: new Date('2026-10-07T12:00:00Z') });
      res = responseMock();
      setSessionCookies(
        res as unknown as Response,
        {
          accessToken: 'jwt',
          refreshToken: 'raw-token',
          refreshTokenExpiresAt: new Date(Date.now() + ttl),
        } as AuthResult,
        configService as unknown as ConfigService,
      );
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('sets the httpOnly access_token cookie on / with the access-token TTL', () => {
      expect(res.cookie).toHaveBeenCalledWith('access_token', 'jwt', {
        httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 900000,
      });
    });

    it('sets the httpOnly refresh_token cookie on /auth, expiring with the refresh-token row', () => {
      expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'raw-token', {
        httpOnly: true, secure: true, sameSite: 'strict', path: '/auth', maxAge: ttl,
      });
    });

    it('sets the readable logged_in=1 cookie on /, with the same expiry', () => {
      expect(res.cookie).toHaveBeenCalledWith('logged_in', '1', {
        httpOnly: false, secure: true, sameSite: 'strict', path: '/', maxAge: ttl,
      });
    });
  });

  describe('clearSessionCookies', () => {
    it('clears each cookie with the path and options it was set with', () => {
      const res = responseMock();

      clearSessionCookies(res as unknown as Response);

      expect(res.clearCookie).toHaveBeenCalledWith('access_token', expect.objectContaining({ path: '/', httpOnly: true }));
      expect(res.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({ path: '/auth', httpOnly: true, secure: true, sameSite: 'strict' }),
      );
      expect(res.clearCookie).toHaveBeenCalledWith('logged_in', expect.objectContaining({ path: '/', httpOnly: false }));
    });
  });

  describe('readRefreshToken', () => {
    it.each([
      ['a present cookie', { refresh_token: 'raw' }, 'raw'],
      ['an empty cookie', { refresh_token: '' }, undefined],
      ['a non-string cookie', { refresh_token: { nested: 'x' } }, undefined],
      ['no refresh_token cookie', { other: 'x' }, undefined],
      ['no parsed cookies at all', undefined, undefined],
    ])('reads %s', (_label, cookies, expected) => {
      expect(readRefreshToken(requestWith(cookies))).toBe(expected);
    });
  });

  describe('resolveRefreshToken', () => {
    it('prefers the cookie over the fallback', () => {
      expect(resolveRefreshToken(requestWith({ refresh_token: 'cookie' }), 'body')).toBe('cookie');
    });

    it('uses the fallback only when the cookie is absent', () => {
      expect(resolveRefreshToken(requestWith({}), 'body')).toBe('body');
    });

    it('returns undefined when neither source carries a token', () => {
      expect(resolveRefreshToken(requestWith({}), '')).toBeUndefined();
    });
  });
});
