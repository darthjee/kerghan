import { AccountHandleService } from '../account-handle.service.js';

describe('AccountHandleService', () => {
  let userRepository: { findOne: jest.Mock };
  let service: AccountHandleService;

  beforeEach(() => {
    userRepository = { findOne: jest.fn() };
    service = new AccountHandleService(userRepository as never);
  });

  describe('getGithubHandle', () => {
    it('returns the stored handle', async () => {
      userRepository.findOne.mockResolvedValue({ id: 1, githubHandle: 'darthjee' });

      await expect(service.getGithubHandle(1)).resolves.toBe('darthjee');
      expect(userRepository.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1 } }));
    });

    it('returns null when the user has no handle', async () => {
      userRepository.findOne.mockResolvedValue({ id: 1, githubHandle: null });

      await expect(service.getGithubHandle(1)).resolves.toBeNull();
    });

    it('returns null when the user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getGithubHandle(999)).resolves.toBeNull();
    });

    it('never writes', async () => {
      const writes = { save: jest.fn(), update: jest.fn() };
      userRepository = { ...writes, findOne: jest.fn().mockResolvedValue(null) } as never;
      service = new AccountHandleService(userRepository as never);

      await service.getGithubHandle(1);

      expect(writes.save).not.toHaveBeenCalled();
      expect(writes.update).not.toHaveBeenCalled();
    });
  });

  describe('lockExistingUser', () => {
    function managerReturning(row: unknown): { manager: never; qb: Record<string, jest.Mock> } {
      const qb: Record<string, jest.Mock> = {};
      for (const name of ['select', 'where', 'setLock']) qb[name] = jest.fn(() => qb);
      qb.getOne = jest.fn().mockResolvedValue(row);
      const repo = { createQueryBuilder: jest.fn(() => qb) };

      return { manager: { getRepository: jest.fn(() => repo) } as never, qb };
    }

    it('returns true for an existing user, under a shared lock', async () => {
      const { manager, qb } = managerReturning({ id: 1 });

      await expect(service.lockExistingUser(1, manager)).resolves.toBe(true);
      expect(qb.setLock).toHaveBeenCalledWith('pessimistic_read');
      expect(qb.where).toHaveBeenCalledWith('user.id = :userId', { userId: 1 });
    });

    it('returns false for an unknown user', async () => {
      const { manager } = managerReturning(null);

      await expect(service.lockExistingUser(999, manager)).resolves.toBe(false);
    });
  });
});
