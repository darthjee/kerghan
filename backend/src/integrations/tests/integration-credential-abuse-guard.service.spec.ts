import { FindOperator } from 'typeorm';
import {
  IntegrationCredentialAbuseGuardService,
  REGISTER_FAILURE_SQL,
} from '../integration-credential-abuse-guard.service.js';

interface FakeRepo {
  findOne: jest.Mock;
  query: jest.Mock;
  update: jest.Mock;
  save: jest.Mock;
}

function fakeRepo(): FakeRepo {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    query: jest.fn().mockResolvedValue(undefined),
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

  describe('registerFailure', () => {
    it('increments atomically through the upsert, never findOne → save', async () => {
      repo.findOne.mockResolvedValue({ userId: 7, failedAttempts: 1, lockedUntil: null });

      await build(repo).registerFailure(7);

      expect(repo.query).toHaveBeenCalledWith(REGISTER_FAILURE_SQL, [7]);
      expect(REGISTER_FAILURE_SQL).toContain('ON DUPLICATE KEY UPDATE `failed_attempts` = `failed_attempts` + 1');
      expect(repo.query.mock.invocationCallOrder[0]).toBeLessThan(repo.findOne.mock.invocationCallOrder[0]);
      expect(repo.save).not.toHaveBeenCalled();
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('trips the lock with a conditional update at the default max (5) for the default 15 minutes', async () => {
      repo.findOne.mockResolvedValue({ userId: 7, failedAttempts: 5, lockedUntil: null });

      await build(repo).registerFailure(7);

      const [criteria, values] = repo.update.mock.calls[0];
      expect(criteria.userId).toBe(7);
      expect(criteria.failedAttempts).toBeInstanceOf(FindOperator);
      expect((criteria.failedAttempts as FindOperator<number>).type).toBe('moreThanOrEqual');
      expect((criteria.failedAttempts as FindOperator<number>).value).toBe(5);
      expect(values).toEqual({ lockedUntil: new Date('2026-10-01T12:15:00.000Z') });
    });

    it('does not lock below the max', async () => {
      repo.findOne.mockResolvedValue({ userId: 7, failedAttempts: 4, lockedUntil: null });

      await build(repo).registerFailure(7);

      expect(repo.update).not.toHaveBeenCalled();
    });

    it('uses the configured max and lock duration', async () => {
      repo.findOne.mockResolvedValue({ userId: 7, failedAttempts: 2, lockedUntil: null });

      await build(repo, {
        KERGHAN_INTEGRATIONS_CREDENTIAL_MAX_ATTEMPTS: '2',
        KERGHAN_INTEGRATIONS_CREDENTIAL_LOCK_MS: '1000',
      }).registerFailure(7);

      expect(repo.update.mock.calls[0][1]).toEqual({ lockedUntil: new Date('2026-10-01T12:00:01.000Z') });
    });

    it('falls back to the defaults for malformed config', async () => {
      repo.findOne.mockResolvedValue({ userId: 7, failedAttempts: 4, lockedUntil: null });

      await build(repo, {
        KERGHAN_INTEGRATIONS_CREDENTIAL_MAX_ATTEMPTS: 'many',
        KERGHAN_INTEGRATIONS_CREDENTIAL_LOCK_MS: 'long',
      }).registerFailure(7);

      expect(repo.update).not.toHaveBeenCalled();
    });

    it('re-locks on the next failure after an expired lock (computeLockoutState semantics)', async () => {
      repo.findOne.mockResolvedValue({ userId: 7, failedAttempts: 6, lockedUntil: new Date('2026-10-01T11:00:00Z') });

      await build(repo).registerFailure(7);

      expect(repo.update).toHaveBeenCalled();
    });

    it('does nothing more when the row vanished after the upsert', async () => {
      await build(repo).registerFailure(7);

      expect(repo.update).not.toHaveBeenCalled();
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
