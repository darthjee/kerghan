import { BadRequestException, ConflictException, HttpException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { LockedException } from '../../core/locked.exception.js';
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

type RepoMock<T extends object> = {
  findOneBy: jest.Mock;
  save: jest.Mock;
} & Partial<T>;

function repoMock<T extends object>(): RepoMock<T> {
  return {
    findOneBy: jest.fn(),
    save: jest.fn(async (entity) => entity),
  } as RepoMock<T>;
}

describe('AccountService', () => {
  let userRepository: RepoMock<User>;
  let authService: { assertAvailableForUpdate: jest.Mock };
  let accountEditAbuseGuardService: {
    isLockedOut: jest.Mock;
    registerFailure: jest.Mock;
    reset: jest.Mock;
  };
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
    } as User;

    userRepository = repoMock<User>();
    userRepository.findOneBy.mockResolvedValue(user);
    authService = { assertAvailableForUpdate: jest.fn().mockResolvedValue(undefined) };
    accountEditAbuseGuardService = {
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
      accountEditAbuseGuardService as unknown as AccountEditAbuseGuardService,
      tokenService as unknown as TokenService,
      asDefaultUserService(defaultUserService),
    );
  }

  describe('updateAccount', () => {
    describe('when only the username is provided', () => {
      it('updates the username and returns the resulting { username, email }', async () => {
        const result = await service.updateAccount(1, {
          currentPassword: 'current-password',
          username: 'new-username',
        });

        expect(result).toEqual({ username: 'new-username', email: 'darthjee@example.com' });
      });

      it('resets the abuse-guard lockout counter on success', async () => {
        await service.updateAccount(1, {
          currentPassword: 'current-password',
          username: 'new-username',
        });

        expect(accountEditAbuseGuardService.reset).toHaveBeenCalledWith(1);
      });

      it('revokes no sessions, even when a current refresh token is presented', async () => {
        await service.updateAccount(1, {
          currentPassword: 'current-password',
          username: 'new-username',

        }, 'current-refresh-token');

        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });
    });

    describe('when only the email is provided', () => {
      it('updates the email and returns the resulting { username, email }', async () => {
        const result = await service.updateAccount(1, {
          currentPassword: 'current-password',
          email: 'new-email@example.com',
        });

        expect(result).toEqual({ username: 'darthjee', email: 'new-email@example.com' });
      });

      it('revokes no sessions, even when a current refresh token is presented', async () => {
        await service.updateAccount(1, {
          currentPassword: 'current-password',
          email: 'new-email@example.com',

        }, 'current-refresh-token');

        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });
    });

    describe('when only the newPassword is provided', () => {
      it('hashes and stores the new password digest', async () => {
        const originalDigest = user.passwordDigest;

        await service.updateAccount(1, {
          currentPassword: 'current-password',
          newPassword: 'brand-new-password',
        });

        const savedUser = userRepository.save.mock.calls[0][0];

        expect(savedUser.passwordDigest).not.toBe(originalDigest);
        await expect(bcrypt.compare('brand-new-password', savedUser.passwordDigest)).resolves.toBe(true);
      });

      it('returns the unchanged { username, email }', async () => {
        const result = await service.updateAccount(1, {
          currentPassword: 'current-password',
          newPassword: 'brand-new-password',
        });

        expect(result).toEqual({ username: 'darthjee', email: 'darthjee@example.com' });
      });

      it('revokes the caller\'s other sessions, keeping the presented refresh token', async () => {
        await service.updateAccount(1, {
          currentPassword: 'current-password',
          newPassword: 'brand-new-password',

        }, 'current-refresh-token');

        expect(tokenService.revokeUserTokens).toHaveBeenCalledWith(1, 'password_change', 'current-refresh-token');
      });

      it('revokes all of the caller\'s sessions when no current refresh token is presented', async () => {
        await service.updateAccount(1, {
          currentPassword: 'current-password',
          newPassword: 'brand-new-password',
        });

        expect(tokenService.revokeUserTokens).toHaveBeenCalledWith(1, 'password_change', undefined);
      });

      it('revokes only after the new password is saved', async () => {
        await service.updateAccount(1, {
          currentPassword: 'current-password',
          newPassword: 'brand-new-password',
        });

        expect(userRepository.save.mock.invocationCallOrder[0]).toBeLessThan(
          tokenService.revokeUserTokens.mock.invocationCallOrder[0],
        );
      });
    });

    describe('when username, email, and newPassword are all provided', () => {
      it('applies all three updates', async () => {
        const result = await service.updateAccount(1, {
          currentPassword: 'current-password',
          username: 'new-username',
          email: 'new-email@example.com',
          newPassword: 'brand-new-password',
        });

        expect(result).toEqual({ username: 'new-username', email: 'new-email@example.com' });

        const savedUser = userRepository.save.mock.calls[0][0];
        await expect(bcrypt.compare('brand-new-password', savedUser.passwordDigest)).resolves.toBe(true);
      });
    });

    describe('when the current password is wrong', () => {
      it('rejects with BadRequestException and does not save any changes', async () => {
        await expect(
          service.updateAccount(1, { currentPassword: 'wrong-password', username: 'new-username' }),
        ).rejects.toThrow(new BadRequestException('Invalid current password'));

        expect(userRepository.save).not.toHaveBeenCalled();
      });

      it('registers a failure with the abuse guard', async () => {
        await expect(
          service.updateAccount(1, { currentPassword: 'wrong-password', username: 'new-username' }),
        ).rejects.toThrow(BadRequestException);

        expect(accountEditAbuseGuardService.registerFailure).toHaveBeenCalledWith(1);
      });

      it('revokes no sessions, even for a password change', async () => {
        await expect(
          service.updateAccount(1, {
            currentPassword: 'wrong-password',
            newPassword: 'brand-new-password',

          }, 'current-refresh-token'),
        ).rejects.toThrow(BadRequestException);

        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });
    });

    describe('when the new username is already taken by another user', () => {
      beforeEach(() => {
        authService.assertAvailableForUpdate.mockRejectedValue(
          new ConflictException('Username already in use'),
        );
      });

      it('rejects with ConflictException and does not save any changes', async () => {
        await expect(
          service.updateAccount(1, { currentPassword: 'current-password', username: 'taken-username' }),
        ).rejects.toThrow(new ConflictException('Username already in use'));

        expect(userRepository.save).not.toHaveBeenCalled();
      });

      it('registers a failure with the abuse guard', async () => {
        await expect(
          service.updateAccount(1, { currentPassword: 'current-password', username: 'taken-username' }),
        ).rejects.toThrow(ConflictException);

        expect(accountEditAbuseGuardService.registerFailure).toHaveBeenCalledWith(1);
      });

      it('revokes no sessions, even for a password change', async () => {
        await expect(
          service.updateAccount(1, {
            currentPassword: 'current-password',
            username: 'taken-username',
            newPassword: 'brand-new-password',
          }),
        ).rejects.toThrow(ConflictException);

        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });
    });

    describe('when the new email is already taken by another user', () => {
      beforeEach(() => {
        authService.assertAvailableForUpdate.mockRejectedValue(
          new ConflictException('Email already in use'),
        );
      });

      it('rejects with ConflictException and does not save any changes', async () => {
        await expect(
          service.updateAccount(1, { currentPassword: 'current-password', email: 'taken@example.com' }),
        ).rejects.toThrow(new ConflictException('Email already in use'));

        expect(userRepository.save).not.toHaveBeenCalled();
      });

      it('registers a failure with the abuse guard', async () => {
        await expect(
          service.updateAccount(1, { currentPassword: 'current-password', email: 'taken@example.com' }),
        ).rejects.toThrow(ConflictException);

        expect(accountEditAbuseGuardService.registerFailure).toHaveBeenCalledWith(1);
      });
    });

    describe('when the caller is locked out', () => {
      beforeEach(() => {
        accountEditAbuseGuardService.isLockedOut.mockResolvedValue(true);
      });

      it('rejects with a 423 LockedException without loading the user', async () => {
        await expect(
          service.updateAccount(1, { currentPassword: 'current-password', username: 'new-username' }),
        ).rejects.toThrow(new LockedException('Account temporarily locked due to too many failed attempts'));

        expect(userRepository.findOneBy).not.toHaveBeenCalled();
      });

      it('rejects with status 423', async () => {
        try {
          await service.updateAccount(1, { currentPassword: 'current-password', username: 'new-username' });
          throw new Error('expected updateAccount to reject');
        } catch (error) {
          expect((error as HttpException).getStatus()).toBe(423);
        }
      });

      it('does not register another failure or save any changes', async () => {
        await expect(
          service.updateAccount(1, { currentPassword: 'current-password', username: 'new-username' }),
        ).rejects.toThrow(HttpException);

        expect(accountEditAbuseGuardService.registerFailure).not.toHaveBeenCalled();
        expect(userRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('when no username, email, or newPassword is provided', () => {
      it('rejects with BadRequestException without loading the user', async () => {
        await expect(
          service.updateAccount(1, { currentPassword: 'current-password' }),
        ).rejects.toThrow(BadRequestException);

        expect(userRepository.findOneBy).not.toHaveBeenCalled();
      });
    });

    describe('when the username/email are set to the value the user already has', () => {
      it('does not treat it as a duplicate (self-exclusion)', async () => {
        await service.updateAccount(1, {
          currentPassword: 'current-password',
          username: 'darthjee',
          email: 'darthjee@example.com',
        });

        expect(authService.assertAvailableForUpdate).toHaveBeenCalledWith(1, undefined, undefined);
        expect(userRepository.save).toHaveBeenCalled();
      });
    });

    describe('when the session no longer matches a real user', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with UnauthorizedException', async () => {
        await expect(
          service.updateAccount(999, { currentPassword: 'current-password', username: 'new-username' }),
        ).rejects.toThrow(UnauthorizedException);
      });
    });

    describe('when the caller is the default user (feature enabled)', () => {
      beforeEach(() => {
        service = buildService(defaultUserServiceDouble(1));
      });

      it.each([
        ['username', { username: 'new-username' }],
        ['email', { email: 'new@example.com' }],
        ['newPassword', { newPassword: 'a-new-password' }],
      ])('rejects a %s change with 409 DEFAULT_USER_MANAGED and saves nothing', async (_field, changes) => {
        await expectDefaultUserManaged(service.updateAccount(1, { currentPassword: 'current-password', ...changes }));

        expect(userRepository.save).not.toHaveBeenCalled();
        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });

      it('rejects even when the values equal the stored ones', async () => {
        await expectDefaultUserManaged(service.updateAccount(1, {
          currentPassword: 'current-password',
          username: 'darthjee',
          email: 'darthjee@example.com',
          newPassword: 'current-password',
        }));

        expect(userRepository.save).not.toHaveBeenCalled();
      });

      it('never checks currentPassword: a wrong one still gets 409', async () => {
        await expectDefaultUserManaged(service.updateAccount(1, { currentPassword: 'wrong', username: 'x' }));

        expect(userRepository.findOneBy).not.toHaveBeenCalled();
      });

      it('never calls registerFailure nor resets the lockout', async () => {
        await expectDefaultUserManaged(service.updateAccount(1, { currentPassword: 'wrong', username: 'x' }));

        expect(accountEditAbuseGuardService.registerFailure).not.toHaveBeenCalled();
        expect(accountEditAbuseGuardService.reset).not.toHaveBeenCalled();
      });

      it('answers 409, not 423, when the default user is locked out', async () => {
        accountEditAbuseGuardService.isLockedOut.mockResolvedValue(true);

        await expectDefaultUserManaged(service.updateAccount(1, { currentPassword: 'current-password', username: 'x' }));

        expect(accountEditAbuseGuardService.isLockedOut).not.toHaveBeenCalled();
      });

      it('still rejects a request with no field with 400, before the block', async () => {
        await expect(service.updateAccount(1, { currentPassword: 'current-password' }))
          .rejects.toThrow(BadRequestException);
      });

      it('leaves other users editable', async () => {
        const other = { ...user, id: 2 } as User;
        userRepository.findOneBy.mockResolvedValue(other);

        await expect(service.updateAccount(2, { currentPassword: 'current-password', username: 'renamed' }))
          .resolves.toEqual({ username: 'renamed', email: 'darthjee@example.com' });
      });
    });

    describe('when the feature is disabled', () => {
      it('lets a user previously synchronized as default user edit as usual', async () => {
        await expect(service.updateAccount(1, { currentPassword: 'current-password', username: 'renamed' }))
          .resolves.toEqual({ username: 'renamed', email: 'darthjee@example.com' });
      });
    });
  });
});
