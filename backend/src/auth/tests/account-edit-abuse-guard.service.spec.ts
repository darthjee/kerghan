import { ConfigService } from '@nestjs/config';
import { AccountEditAbuseGuardService } from '../account-edit-abuse-guard.service.js';
import { AccountEditLockout } from '../entities/account-edit-lockout.entity.js';

type RepoMock = {
  findOne: jest.Mock;
  update: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};

function repoMock(): RepoMock {
  return {
    findOne: jest.fn(async () => null),
    update: jest.fn(),
    create: jest.fn((attrs) => attrs),
    save: jest.fn(),
  };
}

describe('AccountEditAbuseGuardService', () => {
  let accountEditLockoutRepository: RepoMock;
  let configService: { get: jest.Mock };
  let guard: AccountEditAbuseGuardService;

  beforeEach(() => {
    accountEditLockoutRepository = repoMock();
    configService = { get: jest.fn().mockReturnValue(undefined) };

    guard = new AccountEditAbuseGuardService(
      accountEditLockoutRepository as never,
      configService as unknown as ConfigService,
    );
  });

  describe('isLockedOut', () => {
    it('returns false when the user has no lockout row', async () => {
      accountEditLockoutRepository.findOne.mockResolvedValue(null);

      await expect(guard.isLockedOut(1)).resolves.toBe(false);
    });

    it('returns false when lockedUntil is null', async () => {
      accountEditLockoutRepository.findOne.mockResolvedValue({ lockedUntil: null } as AccountEditLockout);

      await expect(guard.isLockedOut(1)).resolves.toBe(false);
    });

    it('returns true when lockedUntil is in the future', async () => {
      accountEditLockoutRepository.findOne.mockResolvedValue({
        lockedUntil: new Date(Date.now() + 60000),
      } as AccountEditLockout);

      await expect(guard.isLockedOut(1)).resolves.toBe(true);
    });

    it('returns false when lockedUntil is in the past (an expired lock is not locked out)', async () => {
      accountEditLockoutRepository.findOne.mockResolvedValue({
        lockedUntil: new Date(Date.now() - 60000),
      } as AccountEditLockout);

      await expect(guard.isLockedOut(1)).resolves.toBe(false);
    });
  });

  describe('registerFailure', () => {
    it('creates a new row with failedAttempts: 1 when the user has no row yet', async () => {
      accountEditLockoutRepository.findOne.mockResolvedValue(null);

      await guard.registerFailure(1);

      expect(accountEditLockoutRepository.create).toHaveBeenCalledWith({
        userId: 1,
        failedAttempts: 1,
        lockedUntil: null,
      });
      expect(accountEditLockoutRepository.save).toHaveBeenCalled();
    });

    it('increments failedAttempts without locking, below the default threshold (5)', async () => {
      accountEditLockoutRepository.findOne.mockResolvedValue({
        id: 10,
        failedAttempts: 0,
        lockedUntil: null,
      } as AccountEditLockout);

      await guard.registerFailure(1);

      expect(accountEditLockoutRepository.update).toHaveBeenCalledWith(10, {
        failedAttempts: 1,
        lockedUntil: null,
      });
    });

    it('locks the row once the default threshold (5) is reached', async () => {
      accountEditLockoutRepository.findOne.mockResolvedValue({
        id: 10,
        failedAttempts: 4,
        lockedUntil: null,
      } as AccountEditLockout);

      await guard.registerFailure(1);

      expect(accountEditLockoutRepository.update).toHaveBeenCalledWith(10, {
        failedAttempts: 5,
        lockedUntil: expect.any(Date),
      });
    });

    it('respects a configured KERGHAN_ACCOUNT_EDIT_MAX_ATTEMPTS override', async () => {
      configService.get.mockImplementation((key: string) =>
        (key === 'KERGHAN_ACCOUNT_EDIT_MAX_ATTEMPTS' ? 2 : undefined),
      );
      accountEditLockoutRepository.findOne.mockResolvedValue({
        id: 10,
        failedAttempts: 1,
        lockedUntil: null,
      } as AccountEditLockout);

      await guard.registerFailure(1);

      expect(accountEditLockoutRepository.update).toHaveBeenCalledWith(10, {
        failedAttempts: 2,
        lockedUntil: expect.any(Date),
      });
    });
  });

  describe('reset', () => {
    it('clears failedAttempts and lockedUntil when a row exists', async () => {
      accountEditLockoutRepository.findOne.mockResolvedValue({
        id: 10,
        failedAttempts: 3,
        lockedUntil: new Date(),
      } as AccountEditLockout);

      await guard.reset(1);

      expect(accountEditLockoutRepository.update).toHaveBeenCalledWith(10, {
        failedAttempts: 0,
        lockedUntil: null,
      });
    });

    it('does nothing when the user has no lockout row', async () => {
      accountEditLockoutRepository.findOne.mockResolvedValue(null);

      await guard.reset(1);

      expect(accountEditLockoutRepository.update).not.toHaveBeenCalled();
    });
  });
});
