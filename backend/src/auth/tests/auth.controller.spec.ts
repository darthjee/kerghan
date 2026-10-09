import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AccountService } from '../account.service.js';
import { AuthController } from '../auth.controller.js';
import { AuthService } from '../auth.service.js';
import { User } from '../entities/user.entity.js';

type AuthServiceMock = {
  login: jest.Mock;
  register: jest.Mock;
  refresh: jest.Mock;
  logout: jest.Mock;
  status: jest.Mock;
};

function authServiceMock(user: User): AuthServiceMock {
  return {
    login: jest.fn().mockResolvedValue(authResult(user)),
    register: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn().mockResolvedValue(undefined),
    status: jest.fn(),
  };
}

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function authResult(user: User): object {
  return {
    user,
    accessToken: 'signed-access-token',
    refreshToken: 'a-refresh-token',
    refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  };
}

function requestWith(cookies: Record<string, string> = {}): Request {
  return { cookies } as unknown as Request;
}

function defaultConfigService(): { get: jest.Mock } {
  return { get: jest.fn((_key: string, defaultValue: number) => defaultValue) };
}

function responseMock(): jest.Mocked<Pick<Response, 'cookie' | 'set' | 'clearCookie'>> {
  return {
    cookie: jest.fn(),
    set: jest.fn(),
    clearCookie: jest.fn(),
  } as never;
}

// Unit-level coverage for `AuthController`'s `ConfigService`-backed
// access-token cookie `maxAge`, independent of the e2e spec's real
// `INestApplication` — kept lightweight since the only behavior under test
// here is the DI wiring/default-fallback, not the full HTTP stack.
describe('AuthController', () => {
  let user: User;
  let authService: AuthServiceMock;
  let res: jest.Mocked<Pick<Response, 'cookie' | 'set' | 'clearCookie'>>;

  beforeEach(() => {
    user = { id: 1, username: 'darthjee', email: 'darthjee@example.com', isAdmin: false } as User;
    authService = authServiceMock(user);
    res = responseMock();
  });

  function buildController(
    { configService = defaultConfigService(), accountService }: {
      configService?: { get: jest.Mock };
      accountService?: { updateAccount: jest.Mock };
    } = {},
  ): AuthController {
    return new AuthController(
      authService as unknown as AuthService,
      configService as unknown as ConfigService,
      accountService as unknown as AccountService,
    );
  }

  describe('access-token cookie maxAge', () => {
    describe('when KERGHAN_ACCESS_TOKEN_TTL_MS is unset', () => {
      it('defaults to 900000ms (15 minutes)', async () => {
        const configService = defaultConfigService();
        const controller = buildController({ configService });

        await controller.login({ username: 'darthjee', password: 'my-password' }, res as unknown as Response);

        expect(configService.get).toHaveBeenCalledWith('KERGHAN_ACCESS_TOKEN_TTL_MS', 900000);
        expect(res.cookie).toHaveBeenCalledWith(
          'access_token',
          'signed-access-token',
          expect.objectContaining({ maxAge: 900000 }),
        );
      });
    });

    describe('when KERGHAN_ACCESS_TOKEN_TTL_MS is set', () => {
      it('uses the configured value', async () => {
        const configService = { get: jest.fn().mockReturnValue(3_600_000) };
        const controller = buildController({ configService });

        await controller.login({ username: 'darthjee', password: 'my-password' }, res as unknown as Response);

        expect(res.cookie).toHaveBeenCalledWith(
          'access_token',
          'signed-access-token',
          expect.objectContaining({ maxAge: 3_600_000 }),
        );
      });
    });
  });

  describe('POST /auth/login.json', () => {
    it('sets the refresh_token and logged_in cookies and leaves refreshToken out of the body', async () => {
      const controller = buildController();

      const body = await controller.login({ username: 'darthjee', password: 'my-password' }, res as unknown as Response);

      expect(body).toEqual({ user: { id: 1, username: 'darthjee', email: 'darthjee@example.com', isAdmin: false } });
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'a-refresh-token',
        expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'strict', path: '/auth' }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'logged_in',
        '1',
        expect.objectContaining({ httpOnly: false, secure: true, sameSite: 'strict', path: '/' }),
      );
    });
  });

  describe('POST /auth/refresh.json', () => {
    beforeEach(() => {
      authService.refresh.mockResolvedValue(authResult(user));
    });

    it('rotates the cookie token', async () => {
      const controller = buildController();

      await controller.refresh(requestWith({ refresh_token: 'cookie-token' }), {}, res as unknown as Response);

      expect(authService.refresh).toHaveBeenCalledWith('cookie-token');
      expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'a-refresh-token', expect.anything());
    });

    it('prefers the cookie over the body fallback token', async () => {
      const controller = buildController();

      await controller.refresh(
        requestWith({ refresh_token: 'cookie-token' }),
        { refreshToken: 'body-token' },
        res as unknown as Response,
      );

      expect(authService.refresh).toHaveBeenCalledWith('cookie-token');
    });

    it('falls back to the body token when the cookie is absent', async () => {
      const controller = buildController();

      await controller.refresh(requestWith(), { refreshToken: 'body-token' }, res as unknown as Response);

      expect(authService.refresh).toHaveBeenCalledWith('body-token');
    });

    it('answers 401 without calling the service, clearing the cookies, when no token is present', async () => {
      const controller = buildController();

      await expect(controller.refresh(requestWith(), {}, res as unknown as Response))
        .rejects.toBeInstanceOf(UnauthorizedException);

      expect(authService.refresh).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', expect.objectContaining({ path: '/auth' }));
    });

    it('clears the cookies and rethrows when the service rejects the token', async () => {
      authService.refresh.mockRejectedValue(new UnauthorizedException());
      const controller = buildController();

      await expect(controller.refresh(requestWith({ refresh_token: 'bad' }), {}, res as unknown as Response))
        .rejects.toBeInstanceOf(UnauthorizedException);

      expect(res.clearCookie).toHaveBeenCalledWith('access_token', expect.objectContaining({ path: '/' }));
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', expect.objectContaining({ path: '/auth' }));
      expect(res.clearCookie).toHaveBeenCalledWith('logged_in', expect.objectContaining({ path: '/' }));
    });

    it('does not clear the cookies on a non-401 failure', async () => {
      authService.refresh.mockRejectedValue(new Error('boom'));
      const controller = buildController();

      await expect(controller.refresh(requestWith({ refresh_token: 'x' }), {}, res as unknown as Response))
        .rejects.toThrow('boom');

      expect(res.clearCookie).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /auth/logoff.json', () => {
    it('revokes the cookie refresh token and clears the session cookies', async () => {
      const controller = buildController();

      await controller.logout(requestWith({ refresh_token: 'a-refresh-token' }), res as unknown as Response);

      expect(authService.logout).toHaveBeenCalledWith('a-refresh-token');
      expect(res.clearCookie).toHaveBeenCalledWith('access_token', expect.objectContaining({ path: '/' }));
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', expect.objectContaining({ path: '/auth' }));
      expect(res.clearCookie).toHaveBeenCalledWith('logged_in', expect.objectContaining({ path: '/' }));
    });

    it('clears the session cookies without revoking anything when the cookie is absent', async () => {
      const controller = buildController();

      await controller.logout(requestWith(), res as unknown as Response);

      expect(authService.logout).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledTimes(3);
    });
  });

  describe('PATCH /auth/account.json', () => {
    it('delegates to AccountService with the session user id and the cookie token, and returns its result', async () => {
      const accountService = {
        updateAccount: jest.fn().mockResolvedValue({ username: 'new-username', email: 'darthjee@example.com' }),
      };
      const controller = buildController({ accountService });
      const dto = { currentPassword: 'my-password', username: 'new-username' };
      const currentUser = { sub: 1, username: 'darthjee', isAdmin: false };

      const result = await controller.updateAccount(dto, currentUser, requestWith({ refresh_token: 'cookie-token' }));

      expect(accountService.updateAccount).toHaveBeenCalledWith(1, dto, 'cookie-token');
      expect(result).toEqual({ username: 'new-username', email: 'darthjee@example.com' });
    });

    it('passes undefined when the cookie is absent', async () => {
      const accountService = { updateAccount: jest.fn().mockResolvedValue({}) };
      const controller = buildController({ accountService });
      const dto = { currentPassword: 'my-password', newPassword: 'new-password' };

      await controller.updateAccount(dto, { sub: 1, username: 'darthjee', isAdmin: false }, requestWith());

      expect(accountService.updateAccount).toHaveBeenCalledWith(1, dto, undefined);
    });
  });

  describe('POST /auth/status.json', () => {
    describe('when the service reports an active session', () => {
      it('responds with { loggedIn: true, isAdmin } without touching the cookies', async () => {
        authService.status.mockResolvedValue({ loggedIn: true, isAdmin: false });
        const controller = buildController();

        const result = await controller.status(
          requestWith({ refresh_token: 'a-refresh-token' }),
          res as unknown as Response,
        );

        expect(authService.status).toHaveBeenCalledWith('a-refresh-token');
        expect(result).toEqual({ loggedIn: true, isAdmin: false });
        expect(res.cookie).not.toHaveBeenCalled();
        expect(res.clearCookie).not.toHaveBeenCalled();
      });
    });

    describe('when the service reports no active session', () => {
      it('responds with { loggedIn: false, isAdmin: false } and clears the session cookies', async () => {
        authService.status.mockResolvedValue({ loggedIn: false, isAdmin: false });
        const controller = buildController();

        const result = await controller.status(requestWith({ refresh_token: 'unknown' }), res as unknown as Response);

        expect(result).toEqual({ loggedIn: false, isAdmin: false });
        expect(res.clearCookie).toHaveBeenCalledTimes(3);
      });
    });

    describe('when the cookie is absent', () => {
      it('asks the service with an undefined token', async () => {
        authService.status.mockResolvedValue({ loggedIn: false, isAdmin: false });
        const controller = buildController();

        await controller.status(requestWith(), res as unknown as Response);

        expect(authService.status).toHaveBeenCalledWith(undefined);
      });
    });
  });
});
