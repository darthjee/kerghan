import { BadRequestException, ConflictException, HttpException, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import bcrypt from 'bcryptjs';
import { IsNull } from 'typeorm';
import { ErrorCodes } from '../../core/error-codes.js';
import { AuthService } from '../auth.service.js';
import { DefaultUserService } from '../default-user.service.js';
import { RefreshToken } from '../entities/refresh-token.entity.js';
import { User } from '../entities/user.entity.js';
import { PasswordResetService } from '../password-reset.service.js';
import { TokenService } from '../token.service.js';
import { UserApprovalConfig } from '../user-approval.config.js';
import { repoMock, RepoMock } from './repo-mock.test-support.js';

describe('AuthService', () => {
  let userRepository: RepoMock<User>;
  let refreshTokenRepository: RepoMock<RefreshToken>;
  let tokenService: {
    issueTokens: jest.Mock;
    hashToken: jest.Mock;
    revokeUserTokens: jest.Mock;
    findActiveToken: jest.Mock;
  };
  let eventEmitter: { emit: jest.Mock };
  let passwordResetService: { recover: jest.Mock; resetPassword: jest.Mock };
  let defaultUserService: { autoLogin: jest.Mock };
  let userApprovalConfig: UserApprovalConfig;
  let service: AuthService;

  function buildService(): AuthService {
    return new AuthService(
      userRepository as never,
      refreshTokenRepository as never,
      tokenService as unknown as TokenService,
      eventEmitter as unknown as EventEmitter2,
      passwordResetService as unknown as PasswordResetService,
      defaultUserService as unknown as DefaultUserService,
      userApprovalConfig,
    );
  }

  const activeToken = {
    id: 10,
    userId: 1,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    keepSignedIn: false,
    sessionUuid: 'session-uuid-1',
    startedAt: new Date('2026-10-01T00:00:00Z'),
  };
  const activeSession = { sessionUuid: activeToken.sessionUuid, startedAt: activeToken.startedAt };

  function stubExpiredRefreshToken(): void {
    refreshTokenRepository.findOneBy.mockResolvedValue({
      ...activeToken,
      expiresAt: new Date(Date.now() - 1000),
    });
  }

  function stubRevokedRefreshToken(revokedReason = 'rotated', expiresAt = activeToken.expiresAt): void {
    refreshTokenRepository.findOneBy.mockResolvedValue({ ...activeToken, revokedAt: new Date(), revokedReason, expiresAt });
  }

  beforeEach(() => {
    userRepository = repoMock<User>();
    refreshTokenRepository = repoMock<RefreshToken>();
    refreshTokenRepository.update.mockResolvedValue({ affected: 1 });
    tokenService = {
      issueTokens: jest.fn(async (user: User) => ({
        user,
        accessToken: 'signed-access-token',
        refreshToken: 'new-refresh-token',
      })),
      hashToken: jest.fn((token: string) => `hashed:${token}`),
      revokeUserTokens: jest.fn().mockResolvedValue(undefined),
      findActiveToken: jest.fn().mockResolvedValue(null),
    };
    eventEmitter = { emit: jest.fn() };
    passwordResetService = { recover: jest.fn(), resetPassword: jest.fn() };
    defaultUserService = { autoLogin: jest.fn().mockResolvedValue(null) };

    userApprovalConfig = new UserApprovalConfig(false);

    service = buildService();
  });

  describe('login', () => {
    let user: User;

    beforeEach(async () => {
      user = {
        id: 1,
        username: 'darthjee',
        email: 'darthjee@example.com',
        passwordDigest: await bcrypt.hash('correct-password', 4),
        isAdmin: false,
      } as User;
    });

    describe('when the username exists and the password matches', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(user);
      });

      it('resolves with the user and a signed access token', async () => {
        const result = await service.login({ username: 'darthjee', password: 'correct-password' });

        expect(result.user).toBe(user);
        expect(result.accessToken).toBe('signed-access-token');
      });

      it('looks the user up by username', async () => {
        await service.login({ username: 'darthjee', password: 'correct-password' });

        expect(userRepository.findOneBy).toHaveBeenCalledWith({ username: 'darthjee' });
      });

      it('delegates session minting to TokenService as a regular session when keepSignedIn is omitted', async () => {
        await service.login({ username: 'darthjee', password: 'correct-password' });

        expect(tokenService.issueTokens).toHaveBeenCalledWith(user, false);
      });

      it('mints a regular session when keepSignedIn is false', async () => {
        await service.login({ username: 'darthjee', password: 'correct-password', keepSignedIn: false });

        expect(tokenService.issueTokens).toHaveBeenCalledWith(user, false);
      });

      it('mints a persistent session when keepSignedIn is true', async () => {
        await service.login({ username: 'darthjee', password: 'correct-password', keepSignedIn: true });

        expect(tokenService.issueTokens).toHaveBeenCalledWith(user, true);
      });
    });

    describe('when the password is wrong', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(user);
      });

      it('rejects with UnauthorizedException', async () => {
        await expect(
          service.login({ username: 'darthjee', password: 'wrong-password' }),
        ).rejects.toThrow(new UnauthorizedException('Invalid username or password'));
      });

      it('does not mint a session', async () => {
        await expect(
          service.login({ username: 'darthjee', password: 'wrong-password' }),
        ).rejects.toThrow(UnauthorizedException);

        expect(tokenService.issueTokens).not.toHaveBeenCalled();
      });
    });

    describe('when the username is unknown', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with UnauthorizedException', async () => {
        await expect(
          service.login({ username: 'nobody', password: 'whatever' }),
        ).rejects.toThrow(new UnauthorizedException('Invalid username or password'));
      });
    });
  });

  // Detailed recover() behavior (token creation, event shape,
  // enumeration-safety) is covered by `password-reset.service.spec.ts`,
  // where that logic actually lives — this only proves the delegation.
  describe('recover', () => {
    it('delegates to PasswordResetService#recover with the given dto', async () => {
      const dto = { email: 'darthjee@example.com' };

      await service.recover(dto);

      expect(passwordResetService.recover).toHaveBeenCalledWith(dto);
    });
  });

  describe('register', () => {
    describe('when the account is created successfully', () => {
      beforeEach(() => {
        userRepository.findOne.mockResolvedValue(null);
      });

      it('resolves with the created user and a signed access token', async () => {
        const result = await service.register({
          username: 'darthjee',
          email: 'darthjee@example.com',
          password: 'my-password',
        });

        expect(result.user).toEqual(
          expect.objectContaining({ username: 'darthjee', email: 'darthjee@example.com' }),
        );
        expect(result.accessToken).toBe('signed-access-token');
      });

      it('delegates session minting to TokenService with the created user', async () => {
        await service.register({
          username: 'darthjee',
          email: 'darthjee@example.com',
          password: 'my-password',
        });

        expect(tokenService.issueTokens).toHaveBeenCalledWith(
          expect.objectContaining({ username: 'darthjee', isAdmin: false }),
          false,
        );
      });

      it('creates the user with a hashed password digest', async () => {
        await service.register({
          username: 'darthjee',
          email: 'darthjee@example.com',
          password: 'my-password',
        });

        const { passwordDigest } = userRepository.create.mock.calls[0][0];

        expect(passwordDigest).not.toBe('my-password');
        await expect(bcrypt.compare('my-password', passwordDigest)).resolves.toBe(true);
      });

      it('creates the user approved when approval is not required', async () => {
        await service.register({ username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' });

        expect(userRepository.create.mock.calls[0][0]).toEqual(expect.objectContaining({ status: 'approved' }));
      });

      it('creates the user pending, still minting a session, when approval is required', async () => {
        userApprovalConfig = new UserApprovalConfig(true);
        service = buildService();

        const result = await service.register({
          username: 'darthjee',
          email: 'darthjee@example.com',
          password: 'my-password',
        });

        expect(userRepository.create.mock.calls[0][0]).toEqual(expect.objectContaining({ status: 'pending' }));
        expect(result.accessToken).toBe('signed-access-token');
        expect(tokenService.issueTokens).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }), false);
      });

      it('emits a user.registered event with the created user', async () => {
        const result = await service.register({
          username: 'darthjee',
          email: 'darthjee@example.com',
          password: 'my-password',
        });

        expect(eventEmitter.emit).toHaveBeenCalledWith(
          'user.registered',
          expect.objectContaining({
            userId: result.user.id,
            username: 'darthjee',
            email: 'darthjee@example.com',
          }),
        );
      });
    });

    describe('when the username is already taken', () => {
      beforeEach(() => {
        userRepository.findOne.mockResolvedValue({ username: 'darthjee', email: 'other@example.com' });
      });

      it('rejects with a 409 ConflictException carrying USERNAME_TAKEN', async () => {
        const error = await service
          .register({ username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' })
          .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ConflictException);
        expect((error as HttpException).getResponse()).toEqual({
          code: ErrorCodes.USERNAME_TAKEN,
          message: 'username is not available',
        });
      });
    });

    describe('when the email is already taken', () => {
      beforeEach(() => {
        userRepository.findOne.mockResolvedValue({ username: 'someone-else', email: 'darthjee@example.com' });
      });

      it('rejects with a 409 ConflictException carrying EMAIL_TAKEN', async () => {
        const error = await service
          .register({ username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' })
          .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ConflictException);
        expect((error as HttpException).getResponse()).toEqual({
          code: ErrorCodes.EMAIL_TAKEN,
          message: 'email is not available',
        });
      });
    });
  });

  describe('assertAvailableForUpdate', () => {
    describe('when every value is available', () => {
      beforeEach(() => {
        userRepository.findOne.mockResolvedValue(null);
      });

      it('resolves', async () => {
        await expect(service.assertAvailableForUpdate(1, 'free', 'free@example.com')).resolves.toBeUndefined();
      });
    });

    describe.each([
      ['username', 'Username already in use', ErrorCodes.USERNAME_TAKEN, ['taken', undefined]],
      ['email', 'Email already in use', ErrorCodes.EMAIL_TAKEN, [undefined, 'taken@example.com']],
    ] as const)('when the %s is taken by another user', (_field, message, code, [username, email]) => {
      beforeEach(() => {
        userRepository.findOne.mockResolvedValue({ id: 2 });
      });

      it(`rejects with a 409 ConflictException carrying ${code}`, async () => {
        const error = await service.assertAvailableForUpdate(1, username, email).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ConflictException);
        expect((error as HttpException).getStatus()).toBe(409);
        expect((error as HttpException).getResponse()).toEqual({ code, message });
      });
    });
  });

  describe('refresh', () => {
    const user = {
      id: 1,
      username: 'darthjee',
      email: 'darthjee@example.com',
      isAdmin: false,
    } as User;

    describe('when the refresh token is active', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue(activeToken);
        userRepository.findOneBy.mockResolvedValue(user);
      });

      it('revokes the presented token before issuing a new pair', async () => {
        const result = await service.refresh('a-refresh-token');

        expect(refreshTokenRepository.update).toHaveBeenCalledWith(
          { id: 10, revokedAt: IsNull() },
          { revokedAt: expect.any(Date), revokedReason: 'rotated' },
        );
        expect(result.user).toBe(user);
        expect(result.accessToken).toBe('signed-access-token');
        expect(result.refreshToken).not.toBe('a-refresh-token');
      });

      it('delegates session minting to TokenService with the reloaded user, staying regular', async () => {
        await service.refresh('a-refresh-token');

        expect(tokenService.issueTokens).toHaveBeenCalledWith(user, false, activeSession);
      });

      it('carries the presented token session identity over to the rotated token', async () => {
        await service.refresh('a-refresh-token');

        expect(tokenService.issueTokens.mock.calls[0][2]).toEqual({
          sessionUuid: 'session-uuid-1',
          startedAt: new Date('2026-10-01T00:00:00Z'),
        });
      });
    });

    describe('when the token is revoked concurrently before the rotation write', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue(activeToken);
        userRepository.findOneBy.mockResolvedValue(user);
        refreshTokenRepository.update.mockResolvedValue({ affected: 0 });
      });

      it('rejects with UnauthorizedException', async () => {
        await expect(service.refresh('a-refresh-token')).rejects.toThrow(
          new UnauthorizedException('Invalid or expired refresh token'),
        );
      });

      it('does not issue a new token pair', async () => {
        await expect(service.refresh('a-refresh-token')).rejects.toThrow(UnauthorizedException);

        expect(tokenService.issueTokens).not.toHaveBeenCalled();
      });

      it('does not trigger replay detection', async () => {
        await expect(service.refresh('a-refresh-token')).rejects.toThrow(UnauthorizedException);

        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });
    });

    describe('when the presented refresh token belongs to a persistent session', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue({ ...activeToken, keepSignedIn: true });
        userRepository.findOneBy.mockResolvedValue(user);
      });

      it('carries keepSignedIn: true over to the rotated token', async () => {
        await service.refresh('a-refresh-token');

        expect(tokenService.issueTokens).toHaveBeenCalledWith(user, true, activeSession);
      });
    });

    describe('when the refresh token is unknown', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with UnauthorizedException', async () => {
        await expect(service.refresh('unknown-token')).rejects.toThrow(
          new UnauthorizedException('Invalid or expired refresh token'),
        );
      });
    });

    describe('when the refresh token was already rotated', () => {
      beforeEach(() => {
        stubRevokedRefreshToken();
      });

      it('rejects with UnauthorizedException, preventing replay', async () => {
        await expect(service.refresh('reused-token')).rejects.toThrow(
          new UnauthorizedException('Invalid or expired refresh token'),
        );
      });

      it('treats the replay as a compromise signal, revoking the rest of the token family', async () => {
        await expect(service.refresh('reused-token')).rejects.toThrow(UnauthorizedException);

        expect(tokenService.revokeUserTokens).toHaveBeenCalledWith(activeToken.userId, 'replay_detected');
      });
    });

    describe('when the refresh token was rotated and has since expired', () => {
      beforeEach(() => {
        stubRevokedRefreshToken('rotated', new Date(Date.now() - 1000));
      });

      it('rejects with a plain UnauthorizedException, revoking nothing', async () => {
        await expect(service.refresh('old-token')).rejects.toThrow(
          new UnauthorizedException('Invalid or expired refresh token'),
        );

        expect(refreshTokenRepository.update).not.toHaveBeenCalled();
        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });
    });

    describe.each([
      'logout', 'user_revoked', 'password_change', 'password_reset', 'admin_password_change', 'replay_detected', null,
    ])('when the refresh token was revoked with reason %p', (reason) => {
      beforeEach(() => {
        stubRevokedRefreshToken(reason as unknown as string);
      });

      it('rejects with a plain UnauthorizedException, revoking nothing', async () => {
        await expect(service.refresh('revoked-token')).rejects.toThrow(
          new UnauthorizedException('Invalid or expired refresh token'),
        );

        expect(refreshTokenRepository.update).not.toHaveBeenCalled();
        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });
    });

    describe('when the refresh token has expired', () => {
      beforeEach(() => {
        stubExpiredRefreshToken();
      });

      it('rejects with UnauthorizedException', async () => {
        await expect(service.refresh('expired-token')).rejects.toThrow(
          new UnauthorizedException('Invalid or expired refresh token'),
        );
      });

      it('does not treat plain expiry as a compromise signal, leaving the token family untouched', async () => {
        await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException);

        expect(refreshTokenRepository.update).not.toHaveBeenCalled();
        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });
    });
  });

  describe('logout', () => {
    it('revokes the matching unrevoked refresh token by its hash, with reason logout', async () => {
      await service.logout('a-refresh-token');

      expect(tokenService.hashToken).toHaveBeenCalledWith('a-refresh-token');
      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { tokenHash: 'hashed:a-refresh-token', revokedAt: IsNull() },
        { revokedAt: expect.any(Date), revokedReason: 'logout' },
      );
    });
  });

  // Detailed token-validation/rejection-reason behavior is covered by
  // `password-reset.service.spec.ts` — this proves AuthService's own
  // contribution: revoking the user's other sessions on success, and
  // never revoking anything when the token is rejected.
  describe('resetPassword', () => {
    describe('when the token is valid', () => {
      beforeEach(() => {
        passwordResetService.resetPassword.mockResolvedValue(1);
      });

      it('revokes every other refresh token belonging to that user', async () => {
        await service.resetPassword({ token: 'a-token', password: 'new-password' });

        expect(tokenService.revokeUserTokens).toHaveBeenCalledWith(1, 'password_reset');
      });
    });

    describe('when the token is rejected', () => {
      beforeEach(() => {
        passwordResetService.resetPassword.mockRejectedValue(
          new BadRequestException('Invalid or expired token'),
        );
      });

      it('propagates the BadRequestException', async () => {
        await expect(
          service.resetPassword({ token: 'bad-token', password: 'new-password' }),
        ).rejects.toThrow(new BadRequestException('Invalid or expired token'));
      });

      it('does not revoke any refresh tokens', async () => {
        await expect(
          service.resetPassword({ token: 'bad-token', password: 'new-password' }),
        ).rejects.toThrow(BadRequestException);

        expect(refreshTokenRepository.update).not.toHaveBeenCalled();
        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });
    });
  });

  describe('status', () => {
    const user = { id: 1, username: 'darthjee', email: 'darthjee@example.com', isAdmin: false } as User;
    const defaultUser = { id: 99, username: 'admin', email: 'admin@kerghan.local', isAdmin: true } as User;
    const autoSession = {
      user: defaultUser,
      accessToken: 'auto-access-token',
      refreshToken: 'auto-refresh-token',
      refreshTokenExpiresAt: new Date(Date.now() + 60_000),
    };

    const expectNothingRevoked = (): void => {
      expect(refreshTokenRepository.update).not.toHaveBeenCalled();
      expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
    };

    it('looks the active token up through TokenService', async () => {
      await service.status('a-refresh-token', '127.0.0.1');

      expect(tokenService.findActiveToken).toHaveBeenCalledWith('a-refresh-token');
    });

    describe('when the refresh token is active', () => {
      beforeEach(() => {
        tokenService.findActiveToken.mockResolvedValue(activeToken);
        userRepository.findOneBy.mockResolvedValue(user);
        defaultUserService.autoLogin.mockResolvedValue(autoSession);
      });

      it('resolves with loggedIn: true and the user isAdmin, with no session', async () => {
        await expect(service.status('a-refresh-token', '127.0.0.1'))
          .resolves.toEqual({ loggedIn: true, isAdmin: false });
      });

      it('looks the user up by the token row userId', async () => {
        await service.status('a-refresh-token');

        expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      });

      it('wins over automatic login, even for another user than the default one', async () => {
        await service.status('a-refresh-token', '127.0.0.1');

        expect(defaultUserService.autoLogin).not.toHaveBeenCalled();
      });

      it('does not mutate anything', async () => {
        await service.status('a-refresh-token');

        expectNothingRevoked();
      });
    });

    describe('when the active token belongs to an admin', () => {
      beforeEach(() => {
        tokenService.findActiveToken.mockResolvedValue(activeToken);
        userRepository.findOneBy.mockResolvedValue({ ...user, isAdmin: true });
      });

      it('resolves with isAdmin: true', async () => {
        await expect(service.status('a-refresh-token')).resolves.toEqual({ loggedIn: true, isAdmin: true });
      });
    });

    describe.each([
      ['missing', undefined],
      ['unknown, expired or revoked', 'inactive-token'],
    ])('when the refresh token is %s', (_label, refreshToken) => {
      describe('and automatic login applies', () => {
        beforeEach(() => {
          defaultUserService.autoLogin.mockResolvedValue(autoSession);
        });

        it('logs in as the default user, returning the session', async () => {
          await expect(service.status(refreshToken, '127.0.0.1'))
            .resolves.toEqual({ loggedIn: true, isAdmin: true, session: autoSession });
        });

        it('passes the client IP to the automatic login', async () => {
          await service.status(refreshToken, '10.1.2.3');

          expect(defaultUserService.autoLogin).toHaveBeenCalledWith('10.1.2.3');
        });

        it('takes isAdmin from the default user', async () => {
          defaultUserService.autoLogin.mockResolvedValue({ ...autoSession, user: { ...defaultUser, isAdmin: false } });

          await expect(service.status(refreshToken, '127.0.0.1')).resolves.toMatchObject({ isAdmin: false });
        });

        it('does not revoke anything', async () => {
          await service.status(refreshToken, '127.0.0.1');

          expectNothingRevoked();
        });
      });

      describe('and automatic login does not apply', () => {
        it('resolves with exactly loggedIn: false and isAdmin: false', async () => {
          await expect(service.status(refreshToken, '10.0.0.1')).resolves.toEqual({ loggedIn: false, isAdmin: false });
        });

        it('does not look up the user nor revoke anything', async () => {
          await service.status(refreshToken, '10.0.0.1');

          expect(userRepository.findOneBy).not.toHaveBeenCalled();
          expectNothingRevoked();
        });
      });
    });

    it('passes an empty client IP when none is given', async () => {
      await service.status(undefined);

      expect(defaultUserService.autoLogin).toHaveBeenCalledWith('');
    });
  });
});
