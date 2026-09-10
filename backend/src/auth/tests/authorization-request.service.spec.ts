import { createHash } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import bcrypt from 'bcryptjs';
import { AuthorizationRequestAbuseGuardService } from '../authorization-request-abuse-guard.service.js';
import { AuthorizationRequestService } from '../authorization-request.service.js';
import { AuthorizationRequest } from '../entities/authorization-request.entity.js';
import { User } from '../entities/user.entity.js';
import { TokenService } from '../token.service.js';

type RepoMock<T extends object> = {
  findOneBy: jest.Mock;
  findOne: jest.Mock;
  find: jest.Mock;
  count: jest.Mock;
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
    findOne: jest.fn(async () => null),
    find: jest.fn(async () => []),
    count: jest.fn(async () => 0),
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

    const abuseGuard = new AuthorizationRequestAbuseGuardService(
      authorizationRequestRepository as never,
      configService as unknown as ConfigService,
    );

    service = new AuthorizationRequestService(
      authorizationRequestRepository as never,
      userRepository as never,
      tokenService as unknown as TokenService,
      eventEmitter as unknown as EventEmitter2,
      configService as unknown as ConfigService,
      abuseGuard,
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

    describe('rate limiting', () => {
      function mockConfig(overrides: Record<string, unknown>): void {
        configService.get.mockImplementation((key: string) => overrides[key]);
      }

      describe('when the per-IP count is at the configured limit', () => {
        beforeEach(() => {
          mockConfig({ KERGHAN_AUTHORIZATION_REQUEST_CREATE_LIMIT: 5 });
          authorizationRequestRepository.count.mockImplementation(async ({ where }: { where: { requestIp?: string } }) =>
            where.requestIp ? 5 : 0,
          );
        });

        it('does not persist a row', async () => {
          userRepository.findOneBy.mockResolvedValue(null);

          await service.create('nobody', '203.0.113.1', 'curl/8.0');

          expect(authorizationRequestRepository.save).not.toHaveBeenCalled();
        });

        it('does not emit authorization-request.created', async () => {
          userRepository.findOneBy.mockResolvedValue(null);

          await service.create('nobody', '203.0.113.1', 'curl/8.0');

          expect(eventEmitter.emit).not.toHaveBeenCalled();
        });

        it('still returns the same { uuid, pollToken, expiresAt } shape, identically for a known username', async () => {
          const user = { id: 1, username: 'darthjee' } as User;
          userRepository.findOneBy.mockResolvedValue(user);

          const result = await service.create('darthjee', '203.0.113.1', 'curl/8.0');

          expect(result).toEqual({
            uuid: expect.any(String),
            pollToken: expect.any(String),
            expiresAt: expect.any(Date),
          });
          expect(authorizationRequestRepository.save).not.toHaveBeenCalled();
        });
      });

      describe('when the per-username count is at the configured limit', () => {
        beforeEach(() => {
          mockConfig({ KERGHAN_AUTHORIZATION_REQUEST_CREATE_LIMIT: 5 });
          authorizationRequestRepository.count.mockImplementation(async ({ where }: { where: { username?: string } }) =>
            where.username ? 5 : 0,
          );
        });

        it('does not persist a row', async () => {
          userRepository.findOneBy.mockResolvedValue(null);

          await service.create('nobody', '203.0.113.1', 'curl/8.0');

          expect(authorizationRequestRepository.save).not.toHaveBeenCalled();
        });
      });

      describe('when neither count is at the limit', () => {
        beforeEach(() => {
          mockConfig({ KERGHAN_AUTHORIZATION_REQUEST_CREATE_LIMIT: 5 });
          authorizationRequestRepository.count.mockResolvedValue(4);
        });

        it('persists the row as usual', async () => {
          userRepository.findOneBy.mockResolvedValue(null);

          await service.create('nobody', '203.0.113.1', 'curl/8.0');

          expect(authorizationRequestRepository.save).toHaveBeenCalled();
        });
      });

      it('always computes both the IP and username counts (never short-circuits)', async () => {
        userRepository.findOneBy.mockResolvedValue(null);

        await service.create('nobody', '203.0.113.1', 'curl/8.0');

        expect(authorizationRequestRepository.count).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ requestIp: '203.0.113.1' }) }),
        );
        expect(authorizationRequestRepository.count).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ username: 'nobody' }) }),
        );
      });
    });

    describe('concurrent-open cap', () => {
      const user = { id: 1, username: 'darthjee' } as User;

      beforeEach(() => {
        userRepository.findOneBy.mockResolvedValue(user);
        configService.get.mockImplementation((key: string) =>
          key === 'KERGHAN_AUTHORIZATION_REQUEST_MAX_OPEN_PER_USER' ? 2 : undefined,
        );
      });

      describe('when the resolved user is at/over the cap', () => {
        const oldestOpenRow = { id: 5, userId: 1, status: 'open' };

        beforeEach(() => {
          authorizationRequestRepository.count.mockResolvedValue(2);
          authorizationRequestRepository.findOne.mockResolvedValue(oldestOpenRow);
        });

        it("evicts the oldest open row by flipping it to 'expired'", async () => {
          await service.create('darthjee', '203.0.113.1', 'curl/8.0');

          expect(authorizationRequestRepository.update).toHaveBeenCalledWith(5, {
            status: 'expired',
            resolvedAt: expect.any(Date),
          });
        });

        it('never rejects — the new row is still persisted', async () => {
          await service.create('darthjee', '203.0.113.1', 'curl/8.0');

          expect(authorizationRequestRepository.save).toHaveBeenCalled();
        });
      });

      describe('when the resolved user is below the cap', () => {
        beforeEach(() => {
          authorizationRequestRepository.count.mockResolvedValue(1);
        });

        it('does not evict anything', async () => {
          await service.create('darthjee', '203.0.113.1', 'curl/8.0');

          expect(authorizationRequestRepository.findOne).not.toHaveBeenCalled();
        });
      });

      describe('when the username does not resolve to a user', () => {
        beforeEach(() => {
          userRepository.findOneBy.mockResolvedValue(null);
        });

        it('never checks or evicts (cap only applies to resolved users)', async () => {
          await service.create('nobody', '203.0.113.1', 'curl/8.0');

          expect(authorizationRequestRepository.findOne).not.toHaveBeenCalled();
        });
      });
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

  describe('listOpenForUser', () => {
    const openRow = {
      id: 1,
      uuid: 'uuid-open',
      username: 'darthjee',
      userId: 1,
      status: 'open',
      pollTokenHash: sha256('poll-token'),
      requestIp: '203.0.113.1',
      requestUserAgent: 'curl/8.0',
      approvedByUserId: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
      resolvedAt: null,
      loggedAt: null,
    };

    it('queries only open, non-expired rows for the given userId, newest first', async () => {
      authorizationRequestRepository.find.mockResolvedValue([openRow]);

      await service.listOpenForUser(1);

      expect(authorizationRequestRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 1, status: 'open' }),
          order: { createdAt: 'DESC' },
        }),
      );
    });

    it('maps rows to the public shape only, leaking no id/pollTokenHash/username/approvedByUserId', async () => {
      authorizationRequestRepository.find.mockResolvedValue([openRow]);

      const result = await service.listOpenForUser(1);

      expect(result).toEqual([
        {
          uuid: 'uuid-open',
          requestIp: '203.0.113.1',
          requestUserAgent: 'curl/8.0',
          createdAt: openRow.createdAt,
          expiresAt: openRow.expiresAt,
        },
      ]);
    });

    it('returns an empty array when nothing matches (userId: null / other users / expired / non-open excluded by the WHERE clause)', async () => {
      authorizationRequestRepository.find.mockResolvedValue([]);

      await expect(service.listOpenForUser(1)).resolves.toEqual([]);
    });
  });

  describe('authorize', () => {
    const approverPasswordDigest = bcrypt.hashSync('approver-password', 10);
    const approver = { id: 1, username: 'darthjee', passwordDigest: approverPasswordDigest } as User;
    const openRow = {
      id: 10,
      uuid: 'uuid-1',
      username: 'darthjee',
      userId: 1,
      status: 'open',
      pollTokenHash: sha256('poll-token'),
      requestIp: '203.0.113.1',
      requestUserAgent: 'curl/8.0',
      approvedByUserId: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
      resolvedAt: null,
      loggedAt: null,
      authorizeFailedAttempts: 0,
      authorizeLockedUntil: null,
    };

    beforeEach(() => {
      userRepository.findOneBy.mockResolvedValue(approver);
    });

    describe('when the row is open, owned by the approver, not expired, and the password is correct', () => {
      beforeEach(() => {
        authorizationRequestRepository.findOneBy.mockResolvedValue({ ...openRow });
      });

      it('marks the row approved with approvedByUserId and resolvedAt set, resetting the cool-off counters', async () => {
        await service.authorize('uuid-1', 1, 'approver-password');

        expect(authorizationRequestRepository.update).toHaveBeenCalledWith(10, {
          status: 'approved',
          approvedByUserId: 1,
          resolvedAt: expect.any(Date),
          authorizeFailedAttempts: 0,
          authorizeLockedUntil: null,
        });
      });

      it('emits authorization-request.approved', async () => {
        await service.authorize('uuid-1', 1, 'approver-password');

        expect(eventEmitter.emit).toHaveBeenCalledWith(
          'authorization-request.approved',
          expect.objectContaining({ uuid: 'uuid-1', approvedByUserId: 1 }),
        );
      });
    });

    describe('when the row is missing', () => {
      beforeEach(() => {
        authorizationRequestRepository.findOneBy.mockResolvedValue(null);
      });

      it('rejects with the uniform BadRequestException', async () => {
        await expect(service.authorize('unknown-uuid', 1, 'approver-password')).rejects.toThrow(
          new BadRequestException('Unable to authorize this request'),
        );
      });

      it('does not emit an event', async () => {
        await expect(service.authorize('unknown-uuid', 1, 'approver-password')).rejects.toThrow();

        expect(eventEmitter.emit).not.toHaveBeenCalled();
      });
    });

    describe('when the row belongs to another user', () => {
      beforeEach(() => {
        authorizationRequestRepository.findOneBy.mockResolvedValue({ ...openRow, userId: 2 });
      });

      it('rejects with the same uniform BadRequestException', async () => {
        await expect(service.authorize('uuid-1', 1, 'approver-password')).rejects.toThrow(
          new BadRequestException('Unable to authorize this request'),
        );
      });

      it('does not emit an event', async () => {
        await expect(service.authorize('uuid-1', 1, 'approver-password')).rejects.toThrow();

        expect(eventEmitter.emit).not.toHaveBeenCalled();
      });
    });

    describe('when the row is not open', () => {
      beforeEach(() => {
        authorizationRequestRepository.findOneBy.mockResolvedValue({ ...openRow, status: 'denied' });
      });

      it('rejects with the same uniform BadRequestException', async () => {
        await expect(service.authorize('uuid-1', 1, 'approver-password')).rejects.toThrow(
          new BadRequestException('Unable to authorize this request'),
        );
      });
    });

    describe('when the row is past its expiresAt', () => {
      beforeEach(() => {
        authorizationRequestRepository.findOneBy.mockResolvedValue({
          ...openRow,
          expiresAt: new Date(Date.now() - 1000),
        });
      });

      it('rejects with the same uniform BadRequestException', async () => {
        await expect(service.authorize('uuid-1', 1, 'approver-password')).rejects.toThrow(
          new BadRequestException('Unable to authorize this request'),
        );
      });
    });

    describe('when the password is wrong', () => {
      beforeEach(() => {
        authorizationRequestRepository.findOneBy.mockResolvedValue({ ...openRow });
      });

      it('rejects with the same uniform BadRequestException', async () => {
        await expect(service.authorize('uuid-1', 1, 'wrong-password')).rejects.toThrow(
          new BadRequestException('Unable to authorize this request'),
        );
      });

      it('increments authorizeFailedAttempts without locking the row (below threshold)', async () => {
        await expect(service.authorize('uuid-1', 1, 'wrong-password')).rejects.toThrow();

        expect(authorizationRequestRepository.update).toHaveBeenCalledWith(10, {
          authorizeFailedAttempts: 1,
          authorizeLockedUntil: null,
        });
      });
    });

    describe('cool-off lockout', () => {
      it('locks the row once authorizeFailedAttempts reaches the configured max-attempts threshold', async () => {
        configService.get.mockImplementation((key: string) =>
          key === 'KERGHAN_AUTHORIZATION_REQUEST_AUTHORIZE_MAX_ATTEMPTS' ? 2 : undefined,
        );
        authorizationRequestRepository.findOneBy.mockResolvedValue({ ...openRow, authorizeFailedAttempts: 1 });

        await expect(service.authorize('uuid-1', 1, 'wrong-password')).rejects.toThrow();

        expect(authorizationRequestRepository.update).toHaveBeenCalledWith(10, {
          authorizeFailedAttempts: 2,
          authorizeLockedUntil: expect.any(Date),
        });
      });

      describe('when the row is already locked', () => {
        beforeEach(() => {
          authorizationRequestRepository.findOneBy.mockResolvedValue({
            ...openRow,
            authorizeFailedAttempts: 5,
            authorizeLockedUntil: new Date(Date.now() + 60000),
          });
        });

        it('rejects with the same uniform BadRequestException as an ordinary wrong-password rejection', async () => {
          await expect(service.authorize('uuid-1', 1, 'my-password')).rejects.toThrow(
            new BadRequestException('Unable to authorize this request'),
          );
        });

        it('still runs the password compare (equivalent cost to a normal attempt), even with the correct password', async () => {
          const compareSpy = jest.spyOn(bcrypt, 'compare');

          await expect(service.authorize('uuid-1', 1, 'approver-password')).rejects.toThrow();

          expect(compareSpy).toHaveBeenCalledWith('approver-password', approverPasswordDigest);
          compareSpy.mockRestore();
        });

        it('does not increment authorizeFailedAttempts further while already locked', async () => {
          await expect(service.authorize('uuid-1', 1, 'wrong-password')).rejects.toThrow();

          expect(authorizationRequestRepository.update).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('deny', () => {
    const openRow = {
      id: 20,
      uuid: 'uuid-2',
      username: 'darthjee',
      userId: 1,
      status: 'open',
      pollTokenHash: sha256('poll-token'),
      requestIp: '203.0.113.1',
      requestUserAgent: 'curl/8.0',
      approvedByUserId: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
      resolvedAt: null,
      loggedAt: null,
    };

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
