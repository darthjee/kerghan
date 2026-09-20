import { BadRequestException } from '@nestjs/common';
import { AuthorizationRequestService } from '../authorization-request.service.js';
import {
  buildFakeAuthorizationRequest,
  createAuthorizationRequestServiceTestContext,
  RepoMock,
} from './authorization-request.service.test-support.js';
import { AuthorizationRequest } from '../entities/authorization-request.entity.js';

describe('AuthorizationRequestService', () => {
  let authorizationRequestRepository: RepoMock<AuthorizationRequest>;
  let eventEmitter: { emit: jest.Mock };
  let service: AuthorizationRequestService;

  beforeEach(() => {
    ({ authorizationRequestRepository, eventEmitter, service } = createAuthorizationRequestServiceTestContext());
  });

  describe('deny', () => {
    const openRow = buildFakeAuthorizationRequest({ id: 20, uuid: 'uuid-2' });

    describe('when the row is open and owned by the approver', () => {
      beforeEach(() => {
        authorizationRequestRepository.findOneBy.mockResolvedValue({ ...openRow });
      });

      it('marks the row denied with resolvedAt set', async () => {
        await service.deny('uuid-2', 1);

        expect(authorizationRequestRepository.update).toHaveBeenCalledWith(20, {
          status: 'denied',
          resolvedAt: expect.any(Date),
        });
      });

      it('emits authorization-request.denied', async () => {
        await service.deny('uuid-2', 1);

        expect(eventEmitter.emit).toHaveBeenCalledWith(
          'authorization-request.denied',
          expect.objectContaining({ uuid: 'uuid-2', deniedByUserId: 1 }),
        );
      });
    });

    describe('when the row is expired but still open', () => {
      beforeEach(() => {
        authorizationRequestRepository.findOneBy.mockResolvedValue({
          ...openRow,
          expiresAt: new Date(Date.now() - 1000),
        });
      });

      it('still denies successfully — no expiry check is performed', async () => {
        await service.deny('uuid-2', 1);

        expect(authorizationRequestRepository.update).toHaveBeenCalledWith(20, {
          status: 'denied',
          resolvedAt: expect.any(Date),
        });
      });
    });

    describe('when the row belongs to another user', () => {
      beforeEach(() => {
        authorizationRequestRepository.findOneBy.mockResolvedValue({ ...openRow, userId: 2 });
      });

      it('rejects with the uniform BadRequestException', async () => {
        await expect(service.deny('uuid-2', 1)).rejects.toThrow(
          new BadRequestException('Unable to deny this request'),
        );
      });
    });

    describe('when the row is not open', () => {
      beforeEach(() => {
        authorizationRequestRepository.findOneBy.mockResolvedValue({ ...openRow, status: 'approved' });
      });

      it('rejects with the same uniform BadRequestException', async () => {
        await expect(service.deny('uuid-2', 1)).rejects.toThrow(
          new BadRequestException('Unable to deny this request'),
        );
      });
    });

    describe('when the row is missing', () => {
      beforeEach(() => {
        authorizationRequestRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with the same uniform BadRequestException', async () => {
        await expect(service.deny('unknown-uuid', 1)).rejects.toThrow(
          new BadRequestException('Unable to deny this request'),
        );
      });
    });
  });
});
