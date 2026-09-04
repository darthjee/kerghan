import AdminUsersController from '../../../../../../../../assets/js/components/resources/admin/pages/controllers/AdminUsersController.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';

describe('AdminUsersController', () => {
  let setUsers;
  let setRowResults;
  let setSearchError;
  let client;

  const users = [{
    id: 1, username: 'foo', email: 'foo@example.com', isAdmin: false, createdAt: '2026-01-01',
  }];

  beforeEach(() => {
    setUsers = jasmine.createSpy('setUsers');
    setRowResults = jasmine.createSpy('setRowResults');
    setSearchError = jasmine.createSpy('setSearchError');
    client = jasmine.createSpyObj('client', ['searchUsers', 'generateRecoveryLink', 'sendRecoveryEmail']);
  });

  describe('#handleSearch', () => {
    it('clears the search error and stores the returned users', async () => {
      client.searchUsers.and.resolveTo({ users });
      const controller = new AdminUsersController(setUsers, setRowResults, setSearchError, client);

      await controller.handleSearch('foo');

      expect(setSearchError).toHaveBeenCalledWith(null);
      expect(client.searchUsers).toHaveBeenCalledWith('foo');
      expect(setUsers).toHaveBeenCalledWith(users);
    });

    it('sets a search error when the request fails', async () => {
      client.searchUsers.and.rejectWith(new Error('network error'));
      const controller = new AdminUsersController(setUsers, setRowResults, setSearchError, client);

      await controller.handleSearch('foo');

      expect(setSearchError).toHaveBeenCalledWith('network error');
      expect(setUsers).not.toHaveBeenCalled();
    });

    it('redirects home without setting a search error on a 403', async () => {
      client.searchUsers.and.rejectWith(new ApiError(403, 'Forbidden'));
      const controller = new AdminUsersController(setUsers, setRowResults, setSearchError, client);
      const fakeWindow = { location: { hash: '' } };

      globalThis.window = fakeWindow;

      try {
        await controller.handleSearch('foo');

        expect(fakeWindow.location.hash).toBe('/');
        expect(setSearchError).not.toHaveBeenCalledWith('Forbidden');
      } finally {
        delete globalThis.window;
      }
    });
  });

  describe('#handleGenerateLink', () => {
    it('stores the returned resetUrl against the user row', async () => {
      client.generateRecoveryLink.and.resolveTo({ resetUrl: 'https://example.com/reset?token=abc' });
      const controller = new AdminUsersController(setUsers, setRowResults, setSearchError, client);

      await controller.handleGenerateLink(1);

      expect(client.generateRecoveryLink).toHaveBeenCalledWith(1);
      const updater = setRowResults.calls.mostRecent().args[0];

      expect(updater({})).toEqual({ 1: { resetUrl: 'https://example.com/reset?token=abc' } });
    });

    it('stores the error against the user row when the request fails', async () => {
      client.generateRecoveryLink.and.rejectWith(new Error('not found'));
      const controller = new AdminUsersController(setUsers, setRowResults, setSearchError, client);

      await controller.handleGenerateLink(1);

      const updater = setRowResults.calls.mostRecent().args[0];

      expect(updater({})).toEqual({ 1: { error: 'not found' } });
    });

    it('redirects home without touching row results on a 403', async () => {
      client.generateRecoveryLink.and.rejectWith(new ApiError(403, 'Forbidden'));
      const controller = new AdminUsersController(setUsers, setRowResults, setSearchError, client);
      const fakeWindow = { location: { hash: '' } };

      globalThis.window = fakeWindow;

      try {
        await controller.handleGenerateLink(1);

        expect(fakeWindow.location.hash).toBe('/');
        expect(setRowResults).not.toHaveBeenCalled();
      } finally {
        delete globalThis.window;
      }
    });
  });

  describe('#handleSendEmail', () => {
    it('stores the returned sent flag against the user row', async () => {
      client.sendRecoveryEmail.and.resolveTo({ sent: true });
      const controller = new AdminUsersController(setUsers, setRowResults, setSearchError, client);

      await controller.handleSendEmail(1);

      expect(client.sendRecoveryEmail).toHaveBeenCalledWith(1);
      const updater = setRowResults.calls.mostRecent().args[0];

      expect(updater({})).toEqual({ 1: { sent: true } });
    });

    it('stores the error against the user row when the request fails', async () => {
      client.sendRecoveryEmail.and.rejectWith(new Error('mail server unreachable'));
      const controller = new AdminUsersController(setUsers, setRowResults, setSearchError, client);

      await controller.handleSendEmail(1);

      const updater = setRowResults.calls.mostRecent().args[0];

      expect(updater({})).toEqual({ 1: { error: 'mail server unreachable' } });
    });

    it('redirects home without touching row results on a 403', async () => {
      client.sendRecoveryEmail.and.rejectWith(new ApiError(403, 'Forbidden'));
      const controller = new AdminUsersController(setUsers, setRowResults, setSearchError, client);
      const fakeWindow = { location: { hash: '' } };

      globalThis.window = fakeWindow;

      try {
        await controller.handleSendEmail(1);

        expect(fakeWindow.location.hash).toBe('/');
        expect(setRowResults).not.toHaveBeenCalled();
      } finally {
        delete globalThis.window;
      }
    });
  });
});
