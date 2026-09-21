import { BadRequestException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import {
  buildFakeAuthorizationRequest,
  useAuthorizationRequestServiceContext,
} from './authorization-request.service.test-support.js';
import { User } from '../entities/user.entity.js';

describe('AuthorizationRequestService', () => {
  const ctx = useAuthorizationRequestServiceContext();

  describe('authorize', () => {
    const approverPasswordDigest = bcrypt.hashSync('approver-password', 10);
    const approver = { id: 1, username: 'darthjee', passwordDigest: approverPasswordDigest } as User;
    const openRow = buildFakeAuthorizationRequest();

    beforeEach(() => {
      ctx.userRepository.findOneBy.mockResolvedValue(approver);
    });

    describe('when the row is open, owned by the approver, not expired, and the password is correct', () => {
      beforeEach(() => {
        ctx.authorizationRequestRepository.findOneBy.mockResolvedValue({ ...openRow });
      });

      it('marks the row approved with approvedByUserId and resolvedAt set, resetting the cool-off counters', async () => {
        await ctx.service.authorize('uuid-1', 1, 'approver-password');

        expect(ctx.authorizationRequestRepository.update).toHaveBeenCalledWith(10, {
          status: 'approved',
          approvedByUserId: 1,
          resolvedAt: expect.any(Date),
          authorizeFailedAttempts: 0,
          authorizeLockedUntil: null,
        });
      });

      it('emits authorization-request.approved', async () => {
        await ctx.service.authorize('uuid-1', 1, 'approver-password');

        expect(ctx.eventEmitter.emit).toHaveBeenCalledWith(
          'authorization-request.approved',
          expect.objectContaining({ uuid: 'uuid-1', approvedByUserId: 1 }),
        );
      });
    });

    describe('when the row is missing', () => {
      beforeEach(() => {
        ctx.authorizationRequestRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with the uniform BadRequestException', async () => {
        await expect(ctx.service.authorize('unknown-uuid', 1, 'approver-password')).rejects.toThrow(
          new BadRequestException('Unable to authorize this request'),
        );
      });

      it('does not emit an event', async () => {
        await expect(ctx.service.authorize('unknown-uuid', 1, 'approver-password')).rejects.toThrow();

        expect(ctx.eventEmitter.emit).not.toHaveBeenCalled();
      });
    });

    describe('when the row belongs to another user', () => {
      beforeEach(() => {
        ctx.authorizationRequestRepository.findOneBy.mockResolvedValue({ ...openRow, userId: 2 });
      });

      it('rejects with the same uniform BadRequestException', async () => {
        await expect(ctx.service.authorize('uuid-1', 1, 'approver-password')).rejects.toThrow(
          new BadRequestException('Unable to authorize this request'),
        );
      });

      it('does not emit an event', async () => {
        await expect(ctx.service.authorize('uuid-1', 1, 'approver-password')).rejects.toThrow();

        expect(ctx.eventEmitter.emit).not.toHaveBeenCalled();
      });
    });

    describe('when the row is not open', () => {
      beforeEach(() => {
        ctx.authorizationRequestRepository.findOneBy.mockResolvedValue({ ...openRow, status: 'denied' });
      });

      it('rejects with the same uniform BadRequestException', async () => {
        await expect(ctx.service.authorize('uuid-1', 1, 'approver-password')).rejects.toThrow(
          new BadRequestException('Unable to authorize this request'),
        );
      });
    });

    describe('when the row is past its expiresAt', () => {
      beforeEach(() => {
        ctx.authorizationRequestRepository.findOneBy.mockResolvedValue({
          ...openRow,
          expiresAt: new Date(Date.now() - 1000),
        });
      });

      it('rejects with the same uniform BadRequestException', async () => {
        await expect(ctx.service.authorize('uuid-1', 1, 'approver-password')).rejects.toThrow(
          new BadRequestException('Unable to authorize this request'),
        );
      });
    });

    describe('when the password is wrong', () => {
      beforeEach(() => {
        ctx.authorizationRequestRepository.findOneBy.mockResolvedValue({ ...openRow });
      });

      it('rejects with the same uniform BadRequestException', async () => {
        await expect(ctx.service.authorize('uuid-1', 1, 'wrong-password')).rejects.toThrow(
          new BadRequestException('Unable to authorize this request'),
        );
      });

      it('increments authorizeFailedAttempts without locking the row (below threshold)', async () => {
        await expect(ctx.service.authorize('uuid-1', 1, 'wrong-password')).rejects.toThrow();

        expect(ctx.authorizationRequestRepository.update).toHaveBeenCalledWith(10, {
          authorizeFailedAttempts: 1,
          authorizeLockedUntil: null,
        });
      });
    });

    describe('cool-off lockout', () => {
      it('locks the row once authorizeFailedAttempts reaches the configured max-attempts threshold', async () => {
        ctx.configService.get.mockImplementation((key: string) =>
          key === 'KERGHAN_AUTHORIZATION_REQUEST_AUTHORIZE_MAX_ATTEMPTS' ? 2 : undefined,
        );
        ctx.authorizationRequestRepository.findOneBy.mockResolvedValue({ ...openRow, authorizeFailedAttempts: 1 });

        await expect(ctx.service.authorize('uuid-1', 1, 'wrong-password')).rejects.toThrow();

        expect(ctx.authorizationRequestRepository.update).toHaveBeenCalledWith(10, {
          authorizeFailedAttempts: 2,
          authorizeLockedUntil: expect.any(Date),
        });
      });

      describe('when the row is already locked', () => {
        beforeEach(() => {
          ctx.authorizationRequestRepository.findOneBy.mockResolvedValue({
            ...openRow,
            authorizeFailedAttempts: 5,
            authorizeLockedUntil: new Date(Date.now() + 60000),
          });
        });

        it('rejects with the same uniform BadRequestException as an ordinary wrong-password rejection', async () => {
          await expect(ctx.service.authorize('uuid-1', 1, 'my-password')).rejects.toThrow(
            new BadRequestException('Unable to authorize this request'),
          );
        });

        it('still runs the password compare (equivalent cost to a normal attempt), even with the correct password', async () => {
          const compareSpy = jest.spyOn(bcrypt, 'compare');

          await expect(ctx.service.authorize('uuid-1', 1, 'approver-password')).rejects.toThrow();

          expect(compareSpy).toHaveBeenCalledWith('approver-password', approverPasswordDigest);
          compareSpy.mockRestore();
        });

        it('does not increment authorizeFailedAttempts further while already locked', async () => {
          await expect(ctx.service.authorize('uuid-1', 1, 'wrong-password')).rejects.toThrow();

          expect(ctx.authorizationRequestRepository.update).not.toHaveBeenCalled();
        });
      });
    });
  });
});
