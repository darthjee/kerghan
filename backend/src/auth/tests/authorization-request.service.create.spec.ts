import { AuthorizationRequestService } from '../authorization-request.service.js';
import {
  createAuthorizationRequestServiceTestContext,
  RepoMock,
  sha256,
} from './authorization-request.service.test-support.js';
import { AuthorizationRequest } from '../entities/authorization-request.entity.js';
import { User } from '../entities/user.entity.js';

describe('AuthorizationRequestService', () => {
  let authorizationRequestRepository: RepoMock<AuthorizationRequest>;
  let userRepository: RepoMock<User>;
  let eventEmitter: { emit: jest.Mock };
  let configService: { get: jest.Mock };
  let service: AuthorizationRequestService;

  beforeEach(() => {
    ({ authorizationRequestRepository, userRepository, eventEmitter, configService, service } =
      createAuthorizationRequestServiceTestContext());
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
});
