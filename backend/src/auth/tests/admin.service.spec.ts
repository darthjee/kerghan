import { BadRequestException, ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ILike } from 'typeorm';
import { ErrorCodes } from '../../core/error-codes.js';
import { MailService } from '../../mail/mail.service.js';
import { AdminService, CANNOT_DENY_SELF_MESSAGE, USER_NOT_PENDING_MESSAGE } from '../admin.service.js';
import { AuthService } from '../auth.service.js';
import { User, UserStatus } from '../entities/user.entity.js';
import { PasswordResetService } from '../password-reset.service.js';
import { TokenService } from '../token.service.js';
import { UserUpdateService } from '../user-update.service.js';
import {
  asDefaultUserService,
  defaultUserServiceDouble,
  DefaultUserServiceDouble,
  expectDefaultUserManaged,
} from './support/default-user-service-double.js';

type UserRepoMock = {
  find: jest.Mock;
  findOneBy: jest.Mock;
  update: jest.Mock;
};

function userRepoMock(): UserRepoMock {
  return {
    find: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
  };
}

describe('AdminService', () => {
  let userRepository: UserRepoMock;
  let authService: { assertAvailableForUpdate: jest.Mock };
  let passwordResetService: { issueToken: jest.Mock };
  let mailService: { sendEmailTemplate: jest.Mock };
  let userUpdateService: { applyUserUpdate: jest.Mock };
  let tokenService: { revokeUserTokens: jest.Mock };
  let service: AdminService;

  beforeEach(() => {
    userRepository = userRepoMock();
    authService = { assertAvailableForUpdate: jest.fn().mockResolvedValue(undefined) };
    passwordResetService = { issueToken: jest.fn() };
    mailService = { sendEmailTemplate: jest.fn() };
    userUpdateService = { applyUserUpdate: jest.fn().mockResolvedValue(undefined) };
    tokenService = { revokeUserTokens: jest.fn().mockResolvedValue(undefined) };

    service = buildService(defaultUserServiceDouble());
  });

  function buildService(defaultUserService: DefaultUserServiceDouble): AdminService {
    return new AdminService(
      userRepository as never,
      authService as unknown as AuthService,
      passwordResetService as unknown as PasswordResetService,
      mailService as unknown as MailService,
      userUpdateService as unknown as UserUpdateService,
      tokenService as unknown as TokenService,
      asDefaultUserService(defaultUserService),
    );
  }

  describe('searchUsers', () => {
    describe('when no query is given', () => {
      it('returns every user', async () => {
        const users = [{ id: 1 } as User, { id: 2 } as User];
        userRepository.find.mockResolvedValue(users);

        await expect(service.searchUsers()).resolves.toBe(users);
        expect(userRepository.find).toHaveBeenCalledWith();
      });
    });

    describe('when a query is given', () => {
      it('matches case-insensitively against username or email', async () => {
        const users = [{ id: 1, username: 'darthjee' } as User];
        userRepository.find.mockResolvedValue(users);

        const result = await service.searchUsers('darth');

        expect(result).toBe(users);
        expect(userRepository.find).toHaveBeenCalledWith({
          where: [{ username: ILike('%darth%') }, { email: ILike('%darth%') }],
        });
      });
    });

    describe('when only a status is given', () => {
      it('filters by that status', async () => {
        const users = [{ id: 1, status: 'pending' } as User];
        userRepository.find.mockResolvedValue(users);

        await expect(service.searchUsers(undefined, 'pending')).resolves.toBe(users);
        expect(userRepository.find).toHaveBeenCalledWith({ where: { status: 'pending' } });
      });
    });

    describe('when both a query and a status are given', () => {
      it('ANDs the status into every username/email branch', async () => {
        userRepository.find.mockResolvedValue([]);

        await service.searchUsers('darth', 'denied');

        expect(userRepository.find).toHaveBeenCalledWith({
          where: [
            { username: ILike('%darth%'), status: 'denied' },
            { email: ILike('%darth%'), status: 'denied' },
          ],
        });
      });
    });
  });

  describe('generateRecoveryLink', () => {
    const user = { id: 1, username: 'darthjee', email: 'darthjee@example.com' } as User;

    describe('when the user exists', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(user);
        passwordResetService.issueToken.mockResolvedValue({
          token: 'plaintext-token',
          resetUrl: 'http://localhost:3000/#/recover-password?token=plaintext-token',
        });
      });

      it('mints a token for that user and returns its resetUrl', async () => {
        await expect(service.generateRecoveryLink(1)).resolves.toEqual({
          resetUrl: 'http://localhost:3000/#/recover-password?token=plaintext-token',
        });
        expect(passwordResetService.issueToken).toHaveBeenCalledWith(user);
      });
    });

    describe('when the user does not exist', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with NotFoundException', async () => {
        await expect(service.generateRecoveryLink(404)).rejects.toThrow(NotFoundException);
        expect(passwordResetService.issueToken).not.toHaveBeenCalled();
      });
    });
  });

  describe('sendRecoveryEmail', () => {
    const user = { id: 1, username: 'darthjee', email: 'darthjee@example.com' } as User;

    describe('when the user does not exist', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with NotFoundException without minting a token', async () => {
        await expect(service.sendRecoveryEmail(404)).rejects.toThrow(NotFoundException);
        expect(passwordResetService.issueToken).not.toHaveBeenCalled();
      });
    });

    describe('when the user exists', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(user);
        passwordResetService.issueToken.mockResolvedValue({
          token: 'plaintext-token',
          resetUrl: 'http://localhost:3000/#/recover-password?token=plaintext-token',
        });
      });

      describe('and the mail transport accepts the message', () => {
        beforeEach(() => {
          mailService.sendEmailTemplate.mockResolvedValue({ status: 'sent', messageId: 'abc' });
        });

        it('resolves with sent: true', async () => {
          await expect(service.sendRecoveryEmail(1)).resolves.toEqual({ sent: true });
        });

        it('sends to the user email with the recovery email content', async () => {
          await service.sendRecoveryEmail(1);

          expect(mailService.sendEmailTemplate).toHaveBeenCalledWith({
            to: 'darthjee@example.com',
            template: 'password-recovery',
            variables: {
              resetUrl: expect.stringContaining(
                'http://localhost:3000/#/recover-password?token=plaintext-token',
              ),
            },
          });
        });
      });

      describe('and email is disabled (skipped)', () => {
        beforeEach(() => {
          mailService.sendEmailTemplate.mockResolvedValue({ status: 'skipped' });
        });

        it('resolves with sent: false', async () => {
          await expect(service.sendRecoveryEmail(1)).resolves.toEqual({ sent: false });
        });
      });

      describe('and the mail transport throws', () => {
        beforeEach(() => {
          mailService.sendEmailTemplate.mockRejectedValue(new Error('smtp exploded'));
        });

        it('resolves with sent: false rather than propagating the error', async () => {
          await expect(service.sendRecoveryEmail(1)).resolves.toEqual({ sent: false });
        });
      });
    });
  });

  describe('editUser', () => {
    const user = { id: 1, username: 'darthjee', email: 'darthjee@example.com' } as User;

    describe('when the user exists', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(user);
      });

      it('applies a username change', async () => {
        const result = await service.editUser(1, { username: 'new-username' });

        expect(result).toBe(user);
        expect(userUpdateService.applyUserUpdate).toHaveBeenCalledWith(user, {
          username: 'new-username',
        });
      });

      it('applies an email change', async () => {
        await service.editUser(1, { email: 'new-email@example.com' });

        expect(userUpdateService.applyUserUpdate).toHaveBeenCalledWith(user, {
          email: 'new-email@example.com',
        });
      });

      it('applies a password change', async () => {
        await service.editUser(1, { newPassword: 'brand-new-password' });

        expect(userUpdateService.applyUserUpdate).toHaveBeenCalledWith(user, {
          newPassword: 'brand-new-password',
        });
      });

      it('checks availability excluding the target user itself', async () => {
        await service.editUser(1, { username: 'new-username', email: 'new-email@example.com' });

        expect(authService.assertAvailableForUpdate).toHaveBeenCalledWith(
          1,
          'new-username',
          'new-email@example.com',
        );
      });

      it('does not treat the value the user already has as a duplicate (self-exclusion)', async () => {
        await service.editUser(1, { username: 'darthjee', email: 'darthjee@example.com' });

        expect(authService.assertAvailableForUpdate).toHaveBeenCalledWith(1, undefined, undefined);
      });

      it('works identically when the target user is the calling admin', async () => {
        const result = await service.editUser(1, { username: 'new-username' });

        expect(result).toBe(user);
      });

      it('revokes all of the target user\'s refresh tokens on a password change', async () => {
        await service.editUser(1, { newPassword: 'brand-new-password' });

        expect(tokenService.revokeUserTokens).toHaveBeenCalledWith(1, 'admin_password_change');
      });

      it('revokes only after the password change is applied', async () => {
        await service.editUser(1, { newPassword: 'brand-new-password' });

        expect(userUpdateService.applyUserUpdate.mock.invocationCallOrder[0]).toBeLessThan(
          tokenService.revokeUserTokens.mock.invocationCallOrder[0],
        );
      });

      it('revokes all tokens, keeping none, when the admin edits their own password', async () => {
        await service.editUser(1, { username: 'new-username', newPassword: 'brand-new-password' });

        expect(tokenService.revokeUserTokens).toHaveBeenCalledTimes(1);
        expect(tokenService.revokeUserTokens).toHaveBeenCalledWith(1, 'admin_password_change');
      });

      it('revokes nothing on a username-only change', async () => {
        await service.editUser(1, { username: 'new-username' });

        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });

      it('revokes nothing on an email-only change', async () => {
        await service.editUser(1, { email: 'new-email@example.com' });

        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });
    });

    describe('when the new username is already taken by another user', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(user);
        authService.assertAvailableForUpdate.mockRejectedValue(
          new ConflictException('Username already in use'),
        );
      });

      it('rejects with ConflictException without applying any changes', async () => {
        await expect(
          service.editUser(1, { username: 'taken-username' }),
        ).rejects.toThrow(new ConflictException('Username already in use'));

        expect(userUpdateService.applyUserUpdate).not.toHaveBeenCalled();
      });

      it('revokes nothing, even for a password change', async () => {
        await expect(
          service.editUser(1, { username: 'taken-username', newPassword: 'brand-new-password' }),
        ).rejects.toThrow(ConflictException);

        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });
    });

    describe('when the new email is already taken by another user', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(user);
        authService.assertAvailableForUpdate.mockRejectedValue(
          new ConflictException('Email already in use'),
        );
      });

      it('rejects with ConflictException without applying any changes', async () => {
        await expect(
          service.editUser(1, { email: 'taken@example.com' }),
        ).rejects.toThrow(new ConflictException('Email already in use'));

        expect(userUpdateService.applyUserUpdate).not.toHaveBeenCalled();
      });
    });

    describe('when no username, email, or newPassword is provided', () => {
      it('rejects with BadRequestException without loading the user', async () => {
        await expect(service.editUser(1, {})).rejects.toThrow(BadRequestException);

        expect(userRepository.findOneBy).not.toHaveBeenCalled();
      });
    });

    describe('when the user does not exist', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with NotFoundException', async () => {
        await expect(service.editUser(404, { username: 'new-username' })).rejects.toThrow(
          NotFoundException,
        );
      });
    });
  });

  describe('approve / deny', () => {
    let rows: Map<number, User>;

    // A stateful stand-in for the repository: `findOneBy` reads the current
    // row (a copy, like a fresh DB read) and `update` applies the partial to
    // every row matching all criteria, resolving `{ affected }`.
    function seed(...users: Partial<User>[]): void {
      rows = new Map(users.map((user) => [user.id as number, { ...user } as User]));
      userRepository.findOneBy.mockImplementation(async ({ id }: { id: number }) => {
        const row = rows.get(id);

        return row ? { ...row } : null;
      });
      userRepository.update.mockImplementation(async (criteria: Partial<User>, partial: Partial<User>) => {
        const matching = [...rows.values()].filter((row) =>
          Object.entries(criteria).every(([key, value]) => (row as never)[key] === value),
        );
        matching.forEach((row) => Object.assign(row, partial));

        return { affected: matching.length };
      });
    }

    async function expectUnprocessable(promise: Promise<unknown>, code: string, message: string): Promise<void> {
      const error = await promise.then(
        () => { throw new Error('expected a 422 rejection'); },
        (rejection: unknown) => rejection,
      );

      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect((error as UnprocessableEntityException).getResponse()).toEqual({ code, message });
    }

    describe('approveUser', () => {
      describe('when the user is pending', () => {
        beforeEach(() => seed({ id: 1, status: UserStatus.PENDING }));

        it('approves the user and returns the reloaded row', async () => {
          await expect(service.approveUser(1)).resolves.toEqual(expect.objectContaining({ id: 1, status: 'approved' }));
          expect(rows.get(1)!.status).toBe('approved');
        });

        it('guards the write on the pending status', async () => {
          await service.approveUser(1);

          expect(userRepository.update).toHaveBeenCalledWith({ id: 1, status: 'pending' }, { status: 'approved' });
        });

        it('leaves the user\'s sessions untouched', async () => {
          await service.approveUser(1);

          expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
        });
      });

      it.each([UserStatus.APPROVED, UserStatus.DENIED])(
        'rejects a %s user with 422 USER_NOT_PENDING, changing nothing',
        async (status) => {
          seed({ id: 1, status });

          await expectUnprocessable(service.approveUser(1), ErrorCodes.USER_NOT_PENDING, USER_NOT_PENDING_MESSAGE);
          expect(rows.get(1)!.status).toBe(status);
        },
      );

      it('rejects with 422 when the user stops being pending before the write (concurrent deny)', async () => {
        seed({ id: 1, status: UserStatus.PENDING });
        userRepository.update.mockResolvedValueOnce({ affected: 0 });

        await expectUnprocessable(service.approveUser(1), ErrorCodes.USER_NOT_PENDING, USER_NOT_PENDING_MESSAGE);
      });

      it('rejects an unknown user with NotFoundException', async () => {
        seed();

        await expect(service.approveUser(404)).rejects.toThrow(NotFoundException);
        expect(userRepository.update).not.toHaveBeenCalled();
      });
    });

    describe('denyUser', () => {
      const adminId = 9;

      it.each([UserStatus.PENDING, UserStatus.APPROVED, UserStatus.DENIED])(
        'denies a %s user and revokes its tokens with admin_denied',
        async (status) => {
          seed({ id: 1, status }, { id: adminId, status: UserStatus.APPROVED });

          await expect(service.denyUser(1, adminId)).resolves.toEqual(expect.objectContaining({ id: 1, status: 'denied' }));
          expect(rows.get(1)!.status).toBe('denied');
          expect(tokenService.revokeUserTokens).toHaveBeenCalledWith(1, 'admin_denied');
        },
      );

      it('rejects an unknown user with NotFoundException, revoking nothing', async () => {
        seed();

        await expect(service.denyUser(404, adminId)).rejects.toThrow(NotFoundException);
        expect(userRepository.update).not.toHaveBeenCalled();
        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });

      it('rejects the caller\'s own account with 422 CANNOT_DENY_SELF, changing nothing', async () => {
        seed({ id: adminId, status: UserStatus.APPROVED });

        await expectUnprocessable(service.denyUser(adminId, adminId), ErrorCodes.CANNOT_DENY_SELF, CANNOT_DENY_SELF_MESSAGE);
        expect(rows.get(adminId)!.status).toBe('approved');
        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });

      describe('when the target is the default user (feature enabled)', () => {
        beforeEach(() => {
          service = buildService(defaultUserServiceDouble(7));
          seed({ id: 7, status: UserStatus.APPROVED });
        });

        it('rejects with 409 DEFAULT_USER_MANAGED, changing nothing', async () => {
          await expectDefaultUserManaged(service.denyUser(7, adminId));

          expect(rows.get(7)!.status).toBe('approved');
          expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
        });

        it('answers 409 rather than 422 when the caller is also the default user', async () => {
          await expectDefaultUserManaged(service.denyUser(7, 7));
        });
      });
    });
  });

  describe('when the target is the default user (feature enabled)', () => {
    const users = new Map<number, User>([
      [7, { id: 7, username: 'Admin', email: 'admin@kerghan.local' } as User],
      [1, { id: 1, username: 'darthjee', email: 'darthjee@example.com' } as User],
    ]);

    beforeEach(() => {
      service = buildService(defaultUserServiceDouble(7));
      userRepository.findOneBy.mockImplementation(async ({ id }: { id: number }) => users.get(id) ?? null);
      passwordResetService.issueToken.mockResolvedValue({ token: 't', resetUrl: 'http://localhost/#/r?token=t' });
      mailService.sendEmailTemplate.mockResolvedValue({ status: 'sent' });
    });

    describe('editUser', () => {
      it.each([
        ['username', { username: 'renamed' }],
        ['email', { email: 'new@example.com' }],
        ['newPassword', { newPassword: 'a-new-password' }],
      ])('rejects a %s change with 409 DEFAULT_USER_MANAGED, writing nothing', async (_field, changes) => {
        await expectDefaultUserManaged(service.editUser(7, changes));

        expect(authService.assertAvailableForUpdate).not.toHaveBeenCalled();
        expect(userUpdateService.applyUserUpdate).not.toHaveBeenCalled();
        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });

      it('rejects even when the values equal the stored ones', async () => {
        await expectDefaultUserManaged(service.editUser(7, { username: 'Admin', email: 'admin@kerghan.local' }));
      });

      it('still answers 404 for an unknown id', async () => {
        await expect(service.editUser(404, { username: 'x' })).rejects.toThrow(NotFoundException);
      });

      it('still answers 400 when no field is present', async () => {
        await expect(service.editUser(7, {})).rejects.toThrow(BadRequestException);
      });

      it('leaves other users editable', async () => {
        await service.editUser(1, { username: 'renamed' });

        expect(userUpdateService.applyUserUpdate).toHaveBeenCalled();
      });
    });

    describe('generateRecoveryLink', () => {
      it('rejects with 409 DEFAULT_USER_MANAGED and creates no token', async () => {
        await expectDefaultUserManaged(service.generateRecoveryLink(7));

        expect(passwordResetService.issueToken).not.toHaveBeenCalled();
      });

      it('still answers 404 for an unknown id', async () => {
        await expect(service.generateRecoveryLink(404)).rejects.toThrow(NotFoundException);
      });

      it('still mints a link for other users', async () => {
        await expect(service.generateRecoveryLink(1)).resolves.toEqual({ resetUrl: 'http://localhost/#/r?token=t' });
      });
    });

    describe('sendRecoveryEmail', () => {
      it('rejects with 409 DEFAULT_USER_MANAGED, creating no token and sending no email', async () => {
        await expectDefaultUserManaged(service.sendRecoveryEmail(7));

        expect(passwordResetService.issueToken).not.toHaveBeenCalled();
        expect(mailService.sendEmailTemplate).not.toHaveBeenCalled();
      });

      it('still answers 404 for an unknown id', async () => {
        await expect(service.sendRecoveryEmail(404)).rejects.toThrow(NotFoundException);
      });

      it('still sends to other users', async () => {
        await expect(service.sendRecoveryEmail(1)).resolves.toEqual({ sent: true });
      });
    });
  });

  describe('when the feature is disabled', () => {
    const formerDefault = { id: 7, username: 'admin', email: 'admin@kerghan.local' } as User;

    beforeEach(() => {
      userRepository.findOneBy.mockResolvedValue(formerDefault);
      passwordResetService.issueToken.mockResolvedValue({ token: 't', resetUrl: 'http://localhost/#/r?token=t' });
    });

    it('edits a user previously synchronized as default user as usual', async () => {
      await service.editUser(7, { username: 'renamed' });

      expect(userUpdateService.applyUserUpdate).toHaveBeenCalledWith(formerDefault, { username: 'renamed' });
    });

    it('mints a recovery link for it as usual', async () => {
      await expect(service.generateRecoveryLink(7)).resolves.toEqual({ resetUrl: 'http://localhost/#/r?token=t' });
    });
  });
});
