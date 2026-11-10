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
});
