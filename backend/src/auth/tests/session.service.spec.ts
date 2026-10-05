import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { IsNull, MoreThan } from 'typeorm';
import { RefreshToken } from '../entities/refresh-token.entity.js';
import { SessionService } from '../session.service.js';
import { repoMock, RepoMock } from './repo-mock.test-support.js';

describe('SessionService', () => {
  let refreshTokenRepository: RepoMock<RefreshToken> & { find: jest.Mock };
  let tokenService: { hashToken: jest.Mock; revokeUserTokens: jest.Mock };
  let service: SessionService;

  const startedAt = new Date('2026-10-01T00:00:00Z');
  const issuedAt = new Date('2026-10-04T00:00:00Z');

  const buildRow = (overrides: Partial<RefreshToken> = {}): RefreshToken => ({
    id: 1,
    userId: 7,
    tokenHash: 'hashed:current-token',
    sessionUuid: 'session-a',
    startedAt,
    issuedAt,
    keepSignedIn: false,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  }) as RefreshToken;

  beforeEach(() => {
    refreshTokenRepository = { ...repoMock<RefreshToken>(), find: jest.fn() };
    tokenService = {
      hashToken: jest.fn((token: string) => `hashed:${token}`),
      revokeUserTokens: jest.fn(),
    };

    service = new SessionService(refreshTokenRepository as never, tokenService as never);
  });

  describe('listActive', () => {
    it('queries only the caller\'s non-revoked, unexpired tokens, most recently used first', async () => {
      refreshTokenRepository.find.mockResolvedValue([]);

      await service.listActive(7, 'current-token');

      expect(refreshTokenRepository.find).toHaveBeenCalledWith({
        where: { userId: 7, revokedAt: IsNull(), expiresAt: MoreThan(expect.any(Date)) },
        order: { issuedAt: 'DESC' },
      });
    });

    it('maps each row to a session, marking the current one', async () => {
      const otherIssuedAt = new Date('2026-10-03T00:00:00Z');

      refreshTokenRepository.find.mockResolvedValue([
        buildRow(),
        buildRow({
          id: 2,
          tokenHash: 'hashed:other-token',
          sessionUuid: 'session-b',
          issuedAt: otherIssuedAt,
          keepSignedIn: true,
        }),
      ]);

      await expect(service.listActive(7, 'current-token')).resolves.toEqual([
        { id: 'session-a', startedAt, lastUsedAt: issuedAt, keepSignedIn: false, current: true },
        { id: 'session-b', startedAt, lastUsedAt: otherIssuedAt, keepSignedIn: true, current: false },
      ]);
    });

    it('marks nothing as current for an unknown token, without throwing', async () => {
      refreshTokenRepository.find.mockResolvedValue([buildRow()]);

      const sessions = await service.listActive(7, 'unknown-token');

      expect(sessions.map((session) => session.current)).toEqual([false]);
    });

    it('never exposes token material', async () => {
      refreshTokenRepository.find.mockResolvedValue([buildRow()]);

      const [session] = await service.listActive(7, 'current-token');

      expect(Object.keys(session).sort()).toEqual(['current', 'id', 'keepSignedIn', 'lastUsedAt', 'startedAt']);
    });
  });

  describe('revoke', () => {
    it('revokes the session\'s unrevoked token, scoped to the caller', async () => {
      refreshTokenRepository.update.mockResolvedValue({ affected: 1 });

      await service.revoke(7, 'session-a');

      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { userId: 7, sessionUuid: 'session-a', revokedAt: IsNull() },
        { revokedAt: expect.any(Date), revokedReason: 'user_revoked' },
      );
    });

    it('throws NotFoundException when nothing matched (unknown, foreign or revoked session)', async () => {
      refreshTokenRepository.update.mockResolvedValue({ affected: 0 });

      await expect(service.revoke(7, 'someone-elses-session')).rejects.toThrow(NotFoundException);
    });
  });

  describe('revokeOthers', () => {
    it('revokes every other token of the user, keeping the presented one', async () => {
      refreshTokenRepository.findOneBy.mockResolvedValue(buildRow());

      await service.revokeOthers(7, 'current-token');

      expect(refreshTokenRepository.findOneBy).toHaveBeenCalledWith({ tokenHash: 'hashed:current-token' });
      expect(tokenService.revokeUserTokens).toHaveBeenCalledWith(7, 'user_revoked', 'current-token');
    });

    const invalidCases: [string, RefreshToken | null][] = [
      ['unknown', null],
      ['revoked', buildRow({ revokedAt: new Date() })],
      ['expired', buildRow({ expiresAt: new Date(Date.now() - 1000) })],
      ['another user\'s', buildRow({ userId: 99 })],
    ];

    it.each(invalidCases)('throws 401 and revokes nothing for an %s token', async (_label, row) => {
      refreshTokenRepository.findOneBy.mockResolvedValue(row);

      await expect(service.revokeOthers(7, 'current-token')).rejects.toThrow(UnauthorizedException);

      expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      expect(refreshTokenRepository.update).not.toHaveBeenCalled();
    });
  });
});
