import { createHash } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { IsNull, Not } from 'typeorm';
import { RefreshToken } from '../entities/refresh-token.entity.js';
import { Session } from '../entities/session.entity.js';
import { User } from '../entities/user.entity.js';
import { TokenService } from '../token.service.js';
import { repoMock, RepoMock } from './repo-mock.test-support.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type Logger = { debug: jest.Mock; info: jest.Mock; warn: jest.Mock; error: jest.Mock };

function buildConfigService(values: Record<string, unknown> = {}): { get: jest.Mock } {
  return { get: jest.fn((key: string) => values[key]) };
}

describe('TokenService', () => {
  let refreshTokenRepository: RepoMock<RefreshToken>;
  let sessionRepository: RepoMock<Session>;
  let jwtService: { sign: jest.Mock };
  let logger: Logger;
  let service: TokenService;

  const buildService = (configValues: Record<string, unknown> = {}): TokenService => new TokenService(
    refreshTokenRepository as never,
    sessionRepository as never,
    jwtService as unknown as JwtService,
    buildConfigService(configValues) as never,
    logger as never,
  );

  beforeEach(() => {
    refreshTokenRepository = repoMock<RefreshToken>();
    sessionRepository = repoMock<Session>();
    jwtService = { sign: jest.fn().mockReturnValue('signed-access-token') };
    logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

    service = buildService();
  });

  describe('issueTokens', () => {
    const user = {
      id: 7,
      username: 'darthjee',
      email: 'darthjee@example.com',
      isAdmin: false,
    } as User;

    it('resolves with the user and the freshly issued token pair', async () => {
      const result = await service.issueTokens(user);

      expect(result.user).toBe(user);
      expect(result.accessToken).toBe('signed-access-token');
      expect(result.refreshToken).toEqual(expect.any(String));
    });

    it('signs the access token with the user sub, username and isAdmin claims', async () => {
      await service.issueTokens(user);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 7,
        username: 'darthjee',
        isAdmin: false,
      });
    });

    it('signs the access token with isAdmin: true for an admin user', async () => {
      await service.issueTokens({ ...user, isAdmin: true } as User);

      expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({ isAdmin: true }));
    });

    it('persists the refresh token as its SHA-256 hash, never in plaintext', async () => {
      const result = await service.issueTokens(user);
      const saved = refreshTokenRepository.save.mock.calls[0][0];

      expect(saved).toEqual(
        expect.objectContaining({ userId: 7, revokedAt: null, tokenHash: expect.any(String) }),
      );
      expect(saved.tokenHash).not.toBe(result.refreshToken);
      expect(saved.tokenHash).toBe(service.hashToken(result.refreshToken));
    });

    const expectTtl = async (
      subject: TokenService,
      keepSignedIn: boolean | undefined,
      ttlMs: number,
    ): Promise<void> => {
      const before = Date.now();

      await (keepSignedIn === undefined
        ? subject.issueTokens(user)
        : subject.issueTokens(user, keepSignedIn));

      const calls = refreshTokenRepository.save.mock.calls;
      const { expiresAt } = calls[calls.length - 1][0];
      const after = Date.now();

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + ttlMs);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(after + ttlMs);
    };

    it('gives the refresh token a 7-day TTL by default', async () => {
      await expectTtl(service, undefined, SEVEN_DAYS_MS);
    });

    it('gives a regular (keepSignedIn: false) refresh token a 7-day TTL', async () => {
      await expectTtl(service, false, SEVEN_DAYS_MS);
    });

    it('gives a persistent (keepSignedIn: true) refresh token a 30-day TTL', async () => {
      await expectTtl(service, true, THIRTY_DAYS_MS);
    });

    it('stores keepSignedIn: false on the row when omitted', async () => {
      await service.issueTokens(user);

      expect(refreshTokenRepository.save.mock.calls[0][0].keepSignedIn).toBe(false);
    });

    it('stores keepSignedIn: true on the row for a persistent session', async () => {
      await service.issueTokens(user, true);

      expect(refreshTokenRepository.save.mock.calls[0][0].keepSignedIn).toBe(true);
    });

    describe('with configured TTLs', () => {
      const configured = {
        KERGHAN_REFRESH_TOKEN_TTL_MS: '60000',
        KERGHAN_PERSISTENT_REFRESH_TOKEN_TTL_MS: '120000',
      };

      it('honors KERGHAN_REFRESH_TOKEN_TTL_MS for a regular session', async () => {
        await expectTtl(buildService(configured), false, 60000);
      });

      it('honors KERGHAN_PERSISTENT_REFRESH_TOKEN_TTL_MS for a persistent session', async () => {
        await expectTtl(buildService(configured), true, 120000);
      });
    });

    describe('with non-numeric TTLs', () => {
      const configured = {
        KERGHAN_REFRESH_TOKEN_TTL_MS: 'abc',
        KERGHAN_PERSISTENT_REFRESH_TOKEN_TTL_MS: 'xyz',
      };

      it('falls back to the defaults without warning', async () => {
        const subject = buildService(configured);

        await expectTtl(subject, false, SEVEN_DAYS_MS);
        await expectTtl(subject, true, THIRTY_DAYS_MS);

        expect(logger.warn).not.toHaveBeenCalled();
      });
    });

    describe('with a zero regular TTL', () => {
      it('falls back to the default and warns exactly once across repeated mints', async () => {
        const subject = buildService({ KERGHAN_REFRESH_TOKEN_TTL_MS: '0' });

        await expectTtl(subject, false, SEVEN_DAYS_MS);
        await expectTtl(subject, false, SEVEN_DAYS_MS);
        await expectTtl(subject, false, SEVEN_DAYS_MS);

        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
          key: 'KERGHAN_REFRESH_TOKEN_TTL_MS',
          fallback: SEVEN_DAYS_MS,
        }));
      });
    });

    describe('with a negative persistent TTL', () => {
      it('falls back to the default and warns exactly once across repeated mints', async () => {
        const subject = buildService({ KERGHAN_PERSISTENT_REFRESH_TOKEN_TTL_MS: '-5' });

        await expectTtl(subject, true, THIRTY_DAYS_MS);
        await expectTtl(subject, true, THIRTY_DAYS_MS);

        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
          key: 'KERGHAN_PERSISTENT_REFRESH_TOKEN_TTL_MS',
          fallback: THIRTY_DAYS_MS,
        }));
      });

      it('never logs token material in the warning', async () => {
        const subject = buildService({ KERGHAN_PERSISTENT_REFRESH_TOKEN_TTL_MS: '-5' });
        const result = await subject.issueTokens(user, true);
        const logged = JSON.stringify(logger.warn.mock.calls);

        expect(logged).not.toContain(result.refreshToken);
        expect(logged).not.toContain(result.accessToken);
      });
    });

    describe('with both TTLs non-positive', () => {
      it('warns once per key', async () => {
        const subject = buildService({
          KERGHAN_REFRESH_TOKEN_TTL_MS: '0',
          KERGHAN_PERSISTENT_REFRESH_TOKEN_TTL_MS: '0',
        });

        await subject.issueTokens(user, false);
        await subject.issueTokens(user, true);
        await subject.issueTokens(user, false);
        await subject.issueTokens(user, true);

        expect(logger.warn).toHaveBeenCalledTimes(2);
      });
    });

    it('writes an auth_sessions bookkeeping row for the user', async () => {
      await service.issueTokens(user);

      expect(sessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 7, lastSeenAt: expect.any(Date) }),
      );
    });
  });

  describe('hashToken', () => {
    it('returns the SHA-256 hex digest of the value', () => {
      expect(service.hashToken('abc')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });

    it('is stable and matches a freshly computed digest', () => {
      const value = 'a-refresh-token';

      expect(service.hashToken(value)).toBe(
        createHash('sha256').update(value).digest('hex'),
      );
    });
  });

  describe('revokeUserTokens', () => {
    it('revokes every unrevoked token of the user when no keep token is given', async () => {
      await service.revokeUserTokens(7);

      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { userId: 7, revokedAt: IsNull() },
        { revokedAt: expect.any(Date) },
      );
    });

    it('excludes the kept token by its hash when a keep token is given', async () => {
      await service.revokeUserTokens(7, 'current-token');

      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        {
          userId: 7,
          revokedAt: IsNull(),
          tokenHash: Not(createHash('sha256').update('current-token').digest('hex')),
        },
        { revokedAt: expect.any(Date) },
      );
    });

    it('treats an empty keep token as no keep token', async () => {
      await service.revokeUserTokens(7, '');

      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { userId: 7, revokedAt: IsNull() },
        { revokedAt: expect.any(Date) },
      );
    });
  });
});
