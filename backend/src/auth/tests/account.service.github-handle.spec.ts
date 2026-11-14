import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { AccountEditAbuseGuardService } from '../account-edit-abuse-guard.service.js';
import { AccountService } from '../account.service.js';
import { AuthService } from '../auth.service.js';
import { User } from '../entities/user.entity.js';
import { TokenService } from '../token.service.js';
import { UserUpdateService } from '../user-update.service.js';
import {
  asDefaultUserService,
  defaultUserServiceDouble,
  DefaultUserServiceDouble,
  expectDefaultUserManaged,
} from './support/default-user-service-double.js';

const ACCOUNT_MESSAGE = 'At least one of username, email, newPassword or githubHandle is required';

describe('AccountService (GitHub handle)', () => {
  let userRepository: { findOneBy: jest.Mock; save: jest.Mock };
  let authService: { assertAvailableForUpdate: jest.Mock };
  let abuseGuard: { isLockedOut: jest.Mock; registerFailure: jest.Mock; reset: jest.Mock };
  let tokenService: { revokeUserTokens: jest.Mock };
  let service: AccountService;
  let user: User;

  beforeEach(async () => {
    user = {
      id: 1,
      username: 'darthjee',
      email: 'darthjee@example.com',
      passwordDigest: await bcrypt.hash('current-password', 4),
      isAdmin: false,
      status: 'approved',
      githubHandle: null,
    } as User;

    userRepository = {
      findOneBy: jest.fn().mockResolvedValue(user),
      save: jest.fn(async (entity) => entity),
    };
    authService = { assertAvailableForUpdate: jest.fn().mockResolvedValue(undefined) };
    abuseGuard = {
      isLockedOut: jest.fn().mockResolvedValue(false),
      registerFailure: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn().mockResolvedValue(undefined),
    };
    tokenService = { revokeUserTokens: jest.fn().mockResolvedValue(undefined) };
    service = buildService(defaultUserServiceDouble());
  });

  function buildService(defaultUserService: DefaultUserServiceDouble): AccountService {
    return new AccountService(
      userRepository as never,
      authService as unknown as AuthService,
      new UserUpdateService(userRepository as never),
      abuseGuard as unknown as AccountEditAbuseGuardService,
      tokenService as unknown as TokenService,
      asDefaultUserService(defaultUserService),
    );
  }

  function expectGuardUntouched(): void {
    expect(abuseGuard.isLockedOut).not.toHaveBeenCalled();
    expect(abuseGuard.registerFailure).not.toHaveBeenCalled();
    expect(abuseGuard.reset).not.toHaveBeenCalled();
  }

  describe('updateAccount, handle-only edit', () => {
    it('stores the handle without a currentPassword and returns the summary', async () => {
      await expect(service.updateAccount(1, { githubHandle: 'darthjee' }))
        .resolves.toEqual({ username: 'darthjee', email: 'darthjee@example.com', githubHandle: 'darthjee' });

      expect(userRepository.save).toHaveBeenCalledWith(expect.objectContaining({ githubHandle: 'darthjee' }));
    });

    it('ignores a wrong currentPassword: same answer, nothing counted', async () => {
      await expect(service.updateAccount(1, { githubHandle: 'darthjee', currentPassword: 'wrong' }))
        .resolves.toEqual({ username: 'darthjee', email: 'darthjee@example.com', githubHandle: 'darthjee' });

      expectGuardUntouched();
    });

    it('never touches the abuse guard (no lockout check, no failure, no reset)', async () => {
      await service.updateAccount(1, { githubHandle: 'darthjee' });

      expectGuardUntouched();
    });

    it('succeeds while the user is locked out', async () => {
      abuseGuard.isLockedOut.mockResolvedValue(true);

      await expect(service.updateAccount(1, { githubHandle: 'darthjee' }))
        .resolves.toMatchObject({ githubHandle: 'darthjee' });
    });

    it('clears the handle with null', async () => {
      user.githubHandle = 'darthjee';

      await expect(service.updateAccount(1, { githubHandle: null }))
        .resolves.toMatchObject({ githubHandle: null });
      expect(userRepository.save).toHaveBeenCalledWith(expect.objectContaining({ githubHandle: null }));
    });

    it('never revokes sessions nor checks availability', async () => {
      await service.updateAccount(1, { githubHandle: 'darthjee' }, 'current-refresh-token');

      expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      expect(authService.assertAvailableForUpdate).not.toHaveBeenCalled();
    });

    it('answers 401 when the session user no longer exists', async () => {
      userRepository.findOneBy.mockResolvedValue(null);

      await expect(service.updateAccount(1, { githubHandle: 'darthjee' })).rejects.toThrow(UnauthorizedException);
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    // The DTO normalises before the service sees the value, so a case-only
    // (`DarthJee`) or `@`-only (`@darthjee`) edit reaches it as `darthjee`.
    it('skips the write when the normalised handle equals the stored one', async () => {
      user.githubHandle = 'darthjee';

      await expect(service.updateAccount(1, { githubHandle: 'darthjee' }))
        .resolves.toEqual({ username: 'darthjee', email: 'darthjee@example.com', githubHandle: 'darthjee' });
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('skips the write when clearing an already empty handle', async () => {
      await expect(service.updateAccount(1, { githubHandle: null })).resolves.toMatchObject({ githubHandle: null });
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a body with only currentPassword with the account message', async () => {
      await expect(service.updateAccount(1, { currentPassword: 'current-password' }))
        .rejects.toThrow(new BadRequestException(ACCOUNT_MESSAGE));
      expect(userRepository.findOneBy).not.toHaveBeenCalled();
    });

    it('rejects an empty body with the account message', async () => {
      await expect(service.updateAccount(1, {})).rejects.toThrow(new BadRequestException(ACCOUNT_MESSAGE));
    });
  });

  describe('updateAccount, mixed edit', () => {
    it('stores the handle in the same save as the managed fields', async () => {
      await expect(service.updateAccount(1, {
        currentPassword: 'current-password', username: 'renamed', githubHandle: 'darthjee',
      })).resolves.toEqual({ username: 'renamed', email: 'darthjee@example.com', githubHandle: 'darthjee' });

      expect(userRepository.save).toHaveBeenCalledTimes(1);
      expect(abuseGuard.reset).toHaveBeenCalledWith(1);
    });

    it('answers 400 without currentPassword, counts a failure and stores no handle', async () => {
      await expect(service.updateAccount(1, { username: 'renamed', githubHandle: 'darthjee' }))
        .rejects.toThrow(new BadRequestException('currentPassword is required'));

      expect(abuseGuard.registerFailure).toHaveBeenCalledWith(1);
      expect(userRepository.save).not.toHaveBeenCalled();
      expect(user.githubHandle).toBeNull();
    });

    it('answers 400 with a wrong currentPassword, counts a failure and stores no handle', async () => {
      await expect(service.updateAccount(1, { currentPassword: 'wrong', username: 'renamed', githubHandle: 'x' }))
        .rejects.toThrow(new BadRequestException('Invalid current password'));

      expect(abuseGuard.registerFailure).toHaveBeenCalledWith(1);
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('stores no handle when a managed field is refused', async () => {
      authService.assertAvailableForUpdate.mockRejectedValue(new ConflictException('Username already in use'));

      await expect(service.updateAccount(1, {
        currentPassword: 'current-password', username: 'taken', githubHandle: 'darthjee',
      })).rejects.toThrow(ConflictException);

      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('updateAccount, managed edit without currentPassword', () => {
    it('answers 400 and counts a failure', async () => {
      await expect(service.updateAccount(1, { email: 'new@example.com' }))
        .rejects.toThrow(new BadRequestException('currentPassword is required'));

      expect(abuseGuard.registerFailure).toHaveBeenCalledWith(1);
    });
  });

  describe('when the caller is the default user (feature enabled)', () => {
    beforeEach(() => {
      service = buildService(defaultUserServiceDouble(1));
    });

    it('applies a handle-only edit', async () => {
      await expect(service.updateAccount(1, { githubHandle: 'darthjee' }))
        .resolves.toMatchObject({ githubHandle: 'darthjee' });
    });

    it('refuses a mixed edit whole with 409, before the lockout and the password check', async () => {
      await expectDefaultUserManaged(service.updateAccount(1, { username: 'renamed', githubHandle: 'darthjee' }));

      expect(abuseGuard.isLockedOut).not.toHaveBeenCalled();
      expect(userRepository.findOneBy).not.toHaveBeenCalled();
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('when the feature is disabled', () => {
    it('lets a user previously synchronized as default user edit the handle and managed fields', async () => {
      await expect(service.updateAccount(1, {
        currentPassword: 'current-password', username: 'renamed', githubHandle: 'darthjee',
      })).resolves.toEqual({ username: 'renamed', email: 'darthjee@example.com', githubHandle: 'darthjee' });
    });
  });

  describe('getAccount', () => {
    it('returns the session user\'s own { username, email, githubHandle }', async () => {
      user.githubHandle = 'darthjee';

      await expect(service.getAccount(1))
        .resolves.toEqual({ username: 'darthjee', email: 'darthjee@example.com', githubHandle: 'darthjee' });
      expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
    });

    it('returns a null githubHandle when unset', async () => {
      await expect(service.getAccount(1)).resolves.toMatchObject({ githubHandle: null });
    });

    it('answers 401 when the user no longer exists', async () => {
      userRepository.findOneBy.mockResolvedValue(null);

      await expect(service.getAccount(1)).rejects.toThrow(new UnauthorizedException('Invalid session'));
    });
  });
});
