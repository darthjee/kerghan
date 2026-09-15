import { AuthorizationRequestService } from '../authorization-request.service.js';
import { AuthorizationRequest } from '../entities/authorization-request.entity.js';
import {
  createAuthorizationRequestServiceTestContext,
  RepoMock,
  sha256,
} from './authorization-request.service.test-support.js';

describe('AuthorizationRequestService', () => {
  let authorizationRequestRepository: RepoMock<AuthorizationRequest>;
  let service: AuthorizationRequestService;

  beforeEach(() => {
    ({ authorizationRequestRepository, service } = createAuthorizationRequestServiceTestContext());
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
});
