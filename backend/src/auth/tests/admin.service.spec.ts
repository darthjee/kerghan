import { NotFoundException } from '@nestjs/common';
import { ILike } from 'typeorm';
import { MailService } from '../../mail/mail.service.js';
import { AdminService } from '../admin.service.js';
import { User } from '../entities/user.entity.js';
import { PasswordResetService } from '../password-reset.service.js';

type UserRepoMock = {
  find: jest.Mock;
  findOneBy: jest.Mock;
};

function userRepoMock(): UserRepoMock {
  return {
    find: jest.fn(),
    findOneBy: jest.fn(),
  };
}

describe('AdminService', () => {
  let userRepository: UserRepoMock;
  let passwordResetService: { issueToken: jest.Mock };
  let mailService: { send: jest.Mock };
  let service: AdminService;

  beforeEach(() => {
    userRepository = userRepoMock();
    passwordResetService = { issueToken: jest.fn() };
    mailService = { send: jest.fn() };

    service = new AdminService(
      userRepository as never,
      passwordResetService as unknown as PasswordResetService,
      mailService as unknown as MailService,
    );
  });

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
          mailService.send.mockResolvedValue({ status: 'sent', messageId: 'abc' });
        });

        it('resolves with sent: true', async () => {
          await expect(service.sendRecoveryEmail(1)).resolves.toEqual({ sent: true });
        });

        it('sends to the user email with the recovery email content', async () => {
          await service.sendRecoveryEmail(1);

          expect(mailService.send).toHaveBeenCalledWith({
            to: 'darthjee@example.com',
            subject: expect.any(String),
            text: expect.stringContaining('http://localhost:3000/#/recover-password?token=plaintext-token'),
          });
        });
      });

      describe('and email is disabled (skipped)', () => {
        beforeEach(() => {
          mailService.send.mockResolvedValue({ status: 'skipped' });
        });

        it('resolves with sent: false', async () => {
          await expect(service.sendRecoveryEmail(1)).resolves.toEqual({ sent: false });
        });
      });

      describe('and the mail transport throws', () => {
        beforeEach(() => {
          mailService.send.mockRejectedValue(new Error('smtp exploded'));
        });

        it('resolves with sent: false rather than propagating the error', async () => {
          await expect(service.sendRecoveryEmail(1)).resolves.toEqual({ sent: false });
        });
      });
    });
  });
});
