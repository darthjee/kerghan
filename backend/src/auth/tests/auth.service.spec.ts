import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { IsNull } from 'typeorm';
import { AuthService } from '../auth.service.js';
import { RefreshToken } from '../entities/refresh-token.entity.js';
import { Session } from '../entities/session.entity.js';
import { User } from '../entities/user.entity.js';

type RepoMock<T extends object> = {
  findOne: jest.Mock;
  findOneBy: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
} & Partial<T>;

function repoMock<T extends object>(): RepoMock<T> {
  return {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn((attrs) => attrs),
    save: jest.fn(async (entity) => ({ id: 1, ...entity })),
    update: jest.fn(),
  } as RepoMock<T>;
}

describe('AuthService', () => {
  let userRepository: RepoMock<User>;
  let refreshTokenRepository: RepoMock<RefreshToken>;
  let sessionRepository: RepoMock<Session>;
  let jwtService: { sign: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    userRepository = repoMock<User>();
    refreshTokenRepository = repoMock<RefreshToken>();
    sessionRepository = repoMock<Session>();
    jwtService = { sign: jest.fn().mockReturnValue('signed-access-token') };
    eventEmitter = { emit: jest.fn() };

    service = new AuthService(
      userRepository as never,
      refreshTokenRepository as never,
      sessionRepository as never,
      jwtService as unknown as JwtService,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe('login', () => {
    let user: User;

    beforeEach(async () => {
      user = {
        id: 1,
        username: 'darthjee',
        email: 'darthjee@example.com',
        passwordDigest: await bcrypt.hash('correct-password', 4),
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

      it('persists a hashed refresh token and a session for the user', async () => {
        const result = await service.login({ username: 'darthjee', password: 'correct-password' });

        expect(refreshTokenRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 1, tokenHash: expect.any(String), revokedAt: null }),
        );
        expect(refreshTokenRepository.save.mock.calls[0][0].tokenHash).not.toBe(result.refreshToken);
        expect(sessionRepository.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 1 }));
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

      it('rejects with BadRequestException', async () => {
        await expect(
          service.register({ username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' }),
        ).rejects.toThrow(new BadRequestException('username is not available'));
      });
    });

    describe('when the email is already taken', () => {
      beforeEach(() => {
        userRepository.findOne.mockResolvedValue({ username: 'someone-else', email: 'darthjee@example.com' });
      });

      it('rejects with BadRequestException', async () => {
        await expect(
          service.register({ username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' }),
        ).rejects.toThrow(new BadRequestException('email is not available'));
      });
    });
  });

  describe('refresh', () => {
    const activeToken = { id: 10, userId: 1, revokedAt: null, expiresAt: new Date(Date.now() + 60_000) };
    const user = { id: 1, username: 'darthjee', email: 'darthjee@example.com' } as User;

    describe('when the refresh token is active', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue(activeToken);
        userRepository.findOneBy.mockResolvedValue(user);
      });

      it('revokes the presented token and issues a new pair', async () => {
        const result = await service.refresh('a-refresh-token');

        expect(refreshTokenRepository.update).toHaveBeenCalledWith(10, { revokedAt: expect.any(Date) });
        expect(result.user).toBe(user);
        expect(result.accessToken).toBe('signed-access-token');
        expect(result.refreshToken).not.toBe('a-refresh-token');
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

    describe('when the refresh token was already revoked', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue({ ...activeToken, revokedAt: new Date() });
      });

      it('rejects with UnauthorizedException, preventing replay', async () => {
        await expect(service.refresh('reused-token')).rejects.toThrow(
          new UnauthorizedException('Invalid or expired refresh token'),
        );
      });

      it('treats the replay as a compromise signal, revoking the rest of the token family', async () => {
        await expect(service.refresh('reused-token')).rejects.toThrow(UnauthorizedException);

        expect(refreshTokenRepository.update).toHaveBeenCalledWith(
          { userId: activeToken.userId, revokedAt: IsNull() },
          { revokedAt: expect.any(Date) },
        );
      });
    });

    describe('when the refresh token has expired', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue({
          ...activeToken,
          expiresAt: new Date(Date.now() - 1000),
        });
      });

      it('rejects with UnauthorizedException', async () => {
        await expect(service.refresh('expired-token')).rejects.toThrow(
          new UnauthorizedException('Invalid or expired refresh token'),
        );
      });

      it('does not treat plain expiry as a compromise signal, leaving the token family untouched', async () => {
        await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException);

        expect(refreshTokenRepository.update).not.toHaveBeenCalled();
      });
    });
  });

  describe('logout', () => {
    it('revokes the matching refresh token by its hash', async () => {
      await service.logout('a-refresh-token');

      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { tokenHash: expect.any(String) },
        { revokedAt: expect.any(Date) },
      );
    });
  });

  describe('status', () => {
    const activeToken = { id: 10, userId: 1, revokedAt: null, expiresAt: new Date(Date.now() + 60_000) };

    describe('when the refresh token is active', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue(activeToken);
      });

      it('resolves with loggedIn: true', async () => {
        await expect(service.status('a-refresh-token')).resolves.toEqual({ loggedIn: true });
      });

      it('does not mutate the token row', async () => {
        await service.status('a-refresh-token');

        expect(refreshTokenRepository.update).not.toHaveBeenCalled();
      });
    });

    describe('when the refresh token is unknown', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue(null);
      });

      it('resolves with loggedIn: false, without throwing', async () => {
        await expect(service.status('unknown-token')).resolves.toEqual({ loggedIn: false });
      });
    });

    describe('when the refresh token has expired', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue({
          ...activeToken,
          expiresAt: new Date(Date.now() - 1000),
        });
      });

      it('resolves with loggedIn: false', async () => {
        await expect(service.status('expired-token')).resolves.toEqual({ loggedIn: false });
      });
    });

    describe('when the refresh token was already revoked', () => {
      beforeEach(() => {
        refreshTokenRepository.findOneBy.mockResolvedValue({ ...activeToken, revokedAt: new Date() });
      });

      it('resolves with loggedIn: false, without throwing', async () => {
        await expect(service.status('revoked-token')).resolves.toEqual({ loggedIn: false });
      });

      it('does not revoke the rest of the token family', async () => {
        await service.status('revoked-token');

        expect(refreshTokenRepository.update).not.toHaveBeenCalled();
      });
    });
  });
});
