import { createHash } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthorizationRequestService } from '../authorization-request.service.js';
import { AuthorizationRequest } from '../entities/authorization-request.entity.js';
import { User } from '../entities/user.entity.js';
import { TokenService } from '../token.service.js';

type RepoMock<T extends object> = {
  findOneBy: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
  createQueryBuilder: jest.Mock;
} & Partial<T>;

function queryBuilderMock(executeResult: { affected: number }): {
  update: jest.Mock;
  set: jest.Mock;
  where: jest.Mock;
  execute: jest.Mock;
} {
  const builder = {
    update: jest.fn(() => builder),
    set: jest.fn(() => builder),
    where: jest.fn(() => builder),
    execute: jest.fn(async () => executeResult),
  };

  return builder;
}

function repoMock<T extends object>(): RepoMock<T> {
  return {
    findOneBy: jest.fn(),
    create: jest.fn((attrs) => attrs),
    save: jest.fn(async (entity) => ({ id: 1, ...entity })),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilderMock({ affected: 1 })),
  } as RepoMock<T>;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('AuthorizationRequestService', () => {
  let authorizationRequestRepository: RepoMock<AuthorizationRequest>;
  let userRepository: RepoMock<User>;
  let tokenService: { issueTokens: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let configService: { get: jest.Mock };
  let service: AuthorizationRequestService;

  beforeEach(() => {
    authorizationRequestRepository = repoMock<AuthorizationRequest>();
    userRepository = repoMock<User>();
    tokenService = { issueTokens: jest.fn(async (user: User) => ({ user, accessToken: 'jwt', refreshToken: 'rt' })) };
    eventEmitter = { emit: jest.fn() };
    configService = { get: jest.fn().mockReturnValue(undefined) };

    service = new AuthorizationRequestService(
      authorizationRequestRepository as never,
      userRepository as never,
      tokenService as unknown as TokenService,
      eventEmitter as unknown as EventEmitter2,
      configService as unknown as ConfigService,
    );
  });

  describe('create', () => {
    const user = { id: 1, username: 'darthjee', email: 'darthjee@example.com' } as User;

    describe('when the username matches an account', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(user);
      });

      it('persists an open row bound to that user', async () => {
        await service.create('darthjee', '203.0.113.1', 'curl/8.0');

        expect(authorizationRequestRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            username: 'darthjee',
            userId: 1,
            status: 'open',
            requestIp: '203.0.113.1',
            requestUserAgent: 'curl/8.0',
          }),
        );
      });

      it('only persists the SHA-256 hash of the poll token', async () => {
        const result = await service.create('darthjee', '203.0.113.1', 'curl/8.0');

        const savedHash = authorizationRequestRepository.save.mock.calls[0][0].pollTokenHash;

        expect(savedHash).toBe(sha256(result.pollToken));
        expect(savedHash).not.toBe(result.pollToken);
      });

      it('emits authorization-request.created', async () => {
        const result = await service.create('darthjee', '203.0.113.1', 'curl/8.0');

        expect(eventEmitter.emit).toHaveBeenCalledWith(
          'authorization-request.created',
          expect.objectContaining({ uuid: result.uuid, username: 'darthjee', userId: 1 }),
        );
      });
    });

    describe('when the username does not match any account', () => {
      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(null);
      });

      it('persists a row with userId: null', async () => {
        await service.create('nobody', '203.0.113.1', 'curl/8.0');

        expect(authorizationRequestRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({ username: 'nobody', userId: null, status: 'open' }),
        );
      });

      it('returns the same shape as a matching username', async () => {
        const result = await service.create('nobody', '203.0.113.1', 'curl/8.0');

        expect(result).toEqual({
          uuid: expect.any(String),
          pollToken: expect.any(String),
          expiresAt: expect.any(Date),
        });
      });

      it('emits authorization-request.created with userId: null', async () => {
        await service.create('nobody', '203.0.113.1', 'curl/8.0');

        expect(eventEmitter.emit).toHaveBeenCalledWith(
          'authorization-request.created',
          expect.objectContaining({ username: 'nobody', userId: null }),
        );
      });
    });

    it('derives expiresAt from the default TTL when unset', async () => {
      userRepository.findOneBy.mockResolvedValue(null);
      const before = Date.now();

      const result = await service.create('nobody', '203.0.113.1', 'curl/8.0');

      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 3600000);
      expect(result.expiresAt.getTime()).toBeLessThan(before + 3600000 + 5000);
    });

    it('coerces a string-valued env override into a numeric offset', async () => {
      userRepository.findOneBy.mockResolvedValue(null);
      configService.get.mockReturnValue('60000');
      const before = Date.now();

      const result = await service.create('nobody', '203.0.113.1', 'curl/8.0');

      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 60000);
      expect(result.expiresAt.getTime()).toBeLessThan(before + 60000 + 5000);
    });
  });

  describe('poll', () => {
    const baseRow = {
      id: 10,
      uuid: 'uuid-1',
      username: 'darthjee',
      userId: 1,
      pollTokenHash: sha256('poll-token'),
      requestIp: '203.0.113.1',
      requestUserAgent: 'curl/8.0',
      approvedByUserId: null,
      expiresAt: new Date(Date.now() + 60000),
      resolvedAt: null,
      loggedAt: null,
    };

    describe('when the uuid is unknown', () => {
      beforeEach(() => {
        authorizationRequestRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with NotFoundException', async () => {
        await expect(service.poll('unknown-uuid', 'poll-token')).rejects.toThrow(NotFoundException);
      });
    });

    describe('when the poll token is wrong', () => {
      beforeEach(() => {
        authorizationRequestRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with the same NotFoundException', async () => {
        await expect(service.poll('uuid-1', 'wrong-token')).rejects.toThrow(NotFoundException);
      });
    });

    describe('when the request is open and not expired', () => {
      beforeEach(() => {
        authorizationRequestRepository.findOneBy.mockResolvedValue({ ...baseRow, status: 'open' });
      });

      it('returns { status: "open" }', async () => {
        await expect(service.poll('uuid-1', 'poll-token')).resolves.toEqual({ status: 'open' });
      });
    });

    describe('when the request is open and past its expiresAt', () => {
      beforeEach(() => {
        authorizationRequestRepository.findOneBy.mockResolvedValue({
          ...baseRow,
          status: 'open',
          expiresAt: new Date(Date.now() - 1000),
        });
      });

      it('flips the row to expired with resolvedAt set', async () => {
        await service.poll('uuid-1', 'poll-token');

        expect(authorizationRequestRepository.update).toHaveBeenCalledWith(10, {
          status: 'expired',
          resolvedAt: expect.any(Date),
        });
      });

      it('returns { status: "expired" }', async () => {
        await expect(service.poll('uuid-1', 'poll-token')).resolves.toEqual({ status: 'expired' });
      });
    });

    describe('when the request was denied', () => {
      beforeEach(() => {
        authorizationRequestRepository.findOneBy.mockResolvedValue({ ...baseRow, status: 'denied' });
      });

      it('returns { status: "denied" } without touching the claim UPDATE', async () => {
        await expect(service.poll('uuid-1', 'poll-token')).resolves.toEqual({ status: 'denied' });
        expect(authorizationRequestRepository.createQueryBuilder).not.toHaveBeenCalled();
      });
    });

    describe('when the request is already logged', () => {
      beforeEach(() => {
        authorizationRequestRepository.findOneBy.mockResolvedValue({ ...baseRow, status: 'logged' });
      });

      it('returns { status: "logged" } with no credentials', async () => {
        await expect(service.poll('uuid-1', 'poll-token')).resolves.toEqual({ status: 'logged' });
      });
    });

    describe('when the request is approved', () => {
      const user = { id: 1, username: 'darthjee', email: 'darthjee@example.com' } as User;

      beforeEach(() => {
        authorizationRequestRepository.findOneBy.mockResolvedValue({ ...baseRow, status: 'approved' });
        userRepository.findOneBy.mockResolvedValue(user);
      });

      describe('and this poll wins the atomic claim (affected: 1)', () => {
        let builder: ReturnType<typeof queryBuilderMock>;

        beforeEach(() => {
          builder = queryBuilderMock({ affected: 1 });
          authorizationRequestRepository.createQueryBuilder.mockReturnValue(builder);
        });

        it('mints a session for the row\'s user', async () => {
          await service.poll('uuid-1', 'poll-token');

          expect(tokenService.issueTokens).toHaveBeenCalledWith(user);
        });

        it('never writes resolvedAt as part of the claim UPDATE', async () => {
          await service.poll('uuid-1', 'poll-token');

          expect(builder.set).toHaveBeenCalledWith(
            expect.not.objectContaining({ resolvedAt: expect.anything() }),
          );
        });

        it('emits authorization-request.logged', async () => {
          await service.poll('uuid-1', 'poll-token');

          expect(eventEmitter.emit).toHaveBeenCalledWith(
            'authorization-request.logged',
            expect.objectContaining({ uuid: 'uuid-1', userId: 1 }),
          );
        });

        it('returns { status: "approved" } with the freshly issued session', async () => {
          const result = await service.poll('uuid-1', 'poll-token');

          expect(result).toEqual({
            status: 'approved',
            authResult: { user, accessToken: 'jwt', refreshToken: 'rt' },
          });
        });
      });

      describe('and this poll loses the atomic claim (affected: 0)', () => {
        beforeEach(() => {
          authorizationRequestRepository.createQueryBuilder.mockReturnValue(queryBuilderMock({ affected: 0 }));
        });

        it('does not mint a session', async () => {
          await service.poll('uuid-1', 'poll-token');

          expect(tokenService.issueTokens).not.toHaveBeenCalled();
        });

        it('returns { status: "logged" } with no credentials', async () => {
          await expect(service.poll('uuid-1', 'poll-token')).resolves.toEqual({ status: 'logged' });
        });
      });
    });
  });
});
