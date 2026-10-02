import {
  ENSURE_LOCKOUT_ROW_SQL,
  IntegrationCredentialAbuseGuardService,
  RELEASE_ATTEMPT_SQL,
  RESERVE_ATTEMPT_SQL,
} from '../integration-credential-abuse-guard.service.js';

const NOW = new Date('2026-10-01T12:00:00.000Z');

interface FakeRepo {
  findOne: jest.Mock;
  query: jest.Mock;
  update: jest.Mock;
  save: jest.Mock;
}

function fakeRepo(): FakeRepo {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    query: jest.fn().mockResolvedValue({ affectedRows: 1 }),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    save: jest.fn(),
  };
}

function build(repo: FakeRepo, env: Record<string, unknown> = {}): IntegrationCredentialAbuseGuardService {
  const configService = { get: jest.fn((key: string) => env[key]) };

  return new IntegrationCredentialAbuseGuardService(repo as never, configService as never);
}

describe('IntegrationCredentialAbuseGuardService', () => {
  let repo: FakeRepo;

  beforeEach(() => {
    repo = fakeRepo();
    jest.useFakeTimers({ now: new Date('2026-10-01T12:00:00.000Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('isLockedOut', () => {
    it('is false without a row', async () => {
      expect(await build(repo).isLockedOut(7)).toBe(false);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { userId: 7 } });
    });

    it('is false without a lock or with an expired one', async () => {
      repo.findOne.mockResolvedValueOnce({ lockedUntil: null });
      repo.findOne.mockResolvedValueOnce({ lockedUntil: new Date('2026-10-01T11:59:59.000Z') });

      expect(await build(repo).isLockedOut(7)).toBe(false);
      expect(await build(repo).isLockedOut(7)).toBe(false);
    });

    it('is true while the lock is in the future', async () => {
      repo.findOne.mockResolvedValue({ lockedUntil: new Date('2026-10-01T12:00:01.000Z') });

      expect(await build(repo).isLockedOut(7)).toBe(true);
    });
  });

  describe('reserveAttempt', () => {
    it('ensures the row, then reserves with one conditional UPDATE — never findOne → save', async () => {
      expect(await build(repo).reserveAttempt(7, NOW)).toBe(true);

      expect(repo.query).toHaveBeenNthCalledWith(1, ENSURE_LOCKOUT_ROW_SQL, [7]);
      expect(repo.query).toHaveBeenNthCalledWith(2, RESERVE_ATTEMPT_SQL, [
        5,
        new Date('2026-10-01T12:15:00.000Z'),
        7,
        NOW,
      ]);
      expect(repo.findOne).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('counts the attempt and trips the lock in the same statement, only while unlocked', () => {
      expect(ENSURE_LOCKOUT_ROW_SQL).toContain('ON DUPLICATE KEY UPDATE `user_id` = `user_id`');
      expect(RESERVE_ATTEMPT_SQL).toContain(
        'SET `locked_until` = IF(`failed_attempts` + 1 >= ?, ?, NULL), `failed_attempts` = `failed_attempts` + 1',
      );
      expect(RESERVE_ATTEMPT_SQL).toContain('WHERE `user_id` = ? AND (`locked_until` IS NULL OR `locked_until` <= ?)');
    });

    it('is refused when no row was affected (locked out)', async () => {
      repo.query.mockResolvedValueOnce({ affectedRows: 0 }).mockResolvedValueOnce({ affectedRows: 0 });

      expect(await build(repo).reserveAttempt(7, NOW)).toBe(false);
    });

    it.each([
      ['no result', undefined],
      ['a result without a count', {}],
      ['a non-numeric count', { affectedRows: '1' }],
    ])('is refused for %s', async (_label, result) => {
      repo.query.mockResolvedValueOnce({ affectedRows: 1 }).mockResolvedValueOnce(result);

      expect(await build(repo).reserveAttempt(7, NOW)).toBe(false);
    });

    it('uses the configured max and lock duration', async () => {
      await build(repo, {
        KERGHAN_INTEGRATIONS_CREDENTIAL_MAX_ATTEMPTS: '2',
        KERGHAN_INTEGRATIONS_CREDENTIAL_LOCK_MS: '1000',
      }).reserveAttempt(7, NOW);

      expect(repo.query.mock.calls[1][1]).toEqual([2, new Date('2026-10-01T12:00:01.000Z'), 7, NOW]);
    });

    it('falls back to the defaults for malformed config', async () => {
      await build(repo, {
        KERGHAN_INTEGRATIONS_CREDENTIAL_MAX_ATTEMPTS: 'many',
        KERGHAN_INTEGRATIONS_CREDENTIAL_LOCK_MS: 'long',
      }).reserveAttempt(7, NOW);

      expect(repo.query.mock.calls[1][1]).toEqual([5, new Date('2026-10-01T12:15:00.000Z'), 7, NOW]);
    });

    it('defaults now to the current time', async () => {
      await build(repo).reserveAttempt(7);

      expect(repo.query.mock.calls[1][1][3]).toEqual(NOW);
    });
  });

  describe('releaseAttempt', () => {
    it('gives the attempt back and lifts the lock in one atomic UPDATE', async () => {
      await build(repo).releaseAttempt(7);

      expect(repo.query).toHaveBeenCalledWith(RELEASE_ATTEMPT_SQL, [7]);
      expect(RELEASE_ATTEMPT_SQL).toContain(
        'SET `failed_attempts` = GREATEST(`failed_attempts` - 1, 0), `locked_until` = NULL',
      );
      expect(repo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('clears the counter and lock in one update', async () => {
      await build(repo).reset(7);

      expect(repo.update).toHaveBeenCalledWith({ userId: 7 }, { failedAttempts: 0, lockedUntil: null });
      expect(repo.findOne).not.toHaveBeenCalled();
    });
  });
});
