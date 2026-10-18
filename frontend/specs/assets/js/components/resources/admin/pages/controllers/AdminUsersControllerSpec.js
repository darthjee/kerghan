import AdminUsersController from '../../../../../../../../assets/js/components/resources/admin/pages/controllers/AdminUsersController.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../support/fakeWindow.js';

describe('AdminUsersController', () => {
  let setUsers;
  let setRowResults;
  let setSearchError;
  let setCurrentUserId;
  let client;
  let confirm;

  const users = [{
    id: 1, username: 'foo', email: 'foo@example.com', isAdmin: false, createdAt: '2026-01-01',
  }];

  const buildController = () => (
    new AdminUsersController(
      setUsers, setRowResults, setSearchError, setCurrentUserId, client, confirm,
    )
  );

  const itRedirectsHomeOn403 = ({
    title, stub, act, assertUntouched,
  }) => {
    it(title, async () => {
      stub(client).and.rejectWith(new ApiError(403, 'Forbidden'));
      const controller = buildController();
      const fakeWindow = installFakeWindow({ location: { hash: '' } });

      await act(controller);

      expect(fakeWindow.location.hash).toBe('/');
      assertUntouched();
    });
  };

  beforeEach(() => {
    setUsers = jasmine.createSpy('setUsers');
    setRowResults = jasmine.createSpy('setRowResults');
    setSearchError = jasmine.createSpy('setSearchError');
    setCurrentUserId = jasmine.createSpy('setCurrentUserId');
    confirm = jasmine.createSpy('confirm').and.returnValue(true);
    client = jasmine.createSpyObj('client', [
      'searchUsers', 'generateRecoveryLink', 'sendRecoveryEmail', 'approveUser', 'denyUser',
    ]);
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('#handleSearch', () => {
    it('clears the search error and stores the returned users', async () => {
      client.searchUsers.and.resolveTo({ users });
      const controller = buildController();

      await controller.handleSearch('foo');

      expect(setSearchError).toHaveBeenCalledWith(null);
      expect(client.searchUsers).toHaveBeenCalledWith('foo', undefined);
      expect(setUsers).toHaveBeenCalledWith(users);
    });

    it('forwards the status filter to the client', async () => {
      client.searchUsers.and.resolveTo({ users, currentUserId: 7 });
      const controller = buildController();

      await controller.handleSearch('foo', 'pending');

      expect(client.searchUsers).toHaveBeenCalledWith('foo', 'pending');
    });

    it('stores the calling admin id', async () => {
      client.searchUsers.and.resolveTo({ users, currentUserId: 7 });
      const controller = buildController();

      await controller.handleSearch('foo');

      expect(setCurrentUserId).toHaveBeenCalledWith(7);
    });

    it('sets a search error when the request fails', async () => {
      client.searchUsers.and.rejectWith(new Error('network error'));
      const controller = buildController();

      await controller.handleSearch('foo');

      expect(setSearchError).toHaveBeenCalledWith('network error');
      expect(setUsers).not.toHaveBeenCalled();
    });

    itRedirectsHomeOn403({
      title: 'redirects home without setting a search error on a 403',
      stub: (c) => c.searchUsers,
      act: (controller) => controller.handleSearch('foo'),
      assertUntouched: () => expect(setSearchError).not.toHaveBeenCalledWith('Forbidden'),
    });
  });

  describe('#handleGenerateLink', () => {
    it('stores the returned resetUrl against the user row', async () => {
      client.generateRecoveryLink.and.resolveTo({ resetUrl: 'https://example.com/reset?token=abc' });
      const controller = buildController();

      await controller.handleGenerateLink(1);

      expect(client.generateRecoveryLink).toHaveBeenCalledWith(1);
      const updater = setRowResults.calls.mostRecent().args[0];

      expect(updater({})).toEqual({ 1: { resetUrl: 'https://example.com/reset?token=abc' } });
    });

    it('stores the error against the user row when the request fails', async () => {
      client.generateRecoveryLink.and.rejectWith(new Error('not found'));
      const controller = buildController();

      await controller.handleGenerateLink(1);

      const updater = setRowResults.calls.mostRecent().args[0];

      expect(updater({})).toEqual({ 1: { error: 'not found' } });
    });

    itRedirectsHomeOn403({
      title: 'redirects home without touching row results on a 403',
      stub: (c) => c.generateRecoveryLink,
      act: (controller) => controller.handleGenerateLink(1),
      assertUntouched: () => expect(setRowResults).not.toHaveBeenCalled(),
    });
  });

  describe('#handleSendEmail', () => {
    it('stores the returned sent flag against the user row', async () => {
      client.sendRecoveryEmail.and.resolveTo({ sent: true });
      const controller = buildController();

      await controller.handleSendEmail(1);

      expect(client.sendRecoveryEmail).toHaveBeenCalledWith(1);
      const updater = setRowResults.calls.mostRecent().args[0];

      expect(updater({})).toEqual({ 1: { sent: true } });
    });

    it('stores the error against the user row when the request fails', async () => {
      client.sendRecoveryEmail.and.rejectWith(new Error('mail server unreachable'));
      const controller = buildController();

      await controller.handleSendEmail(1);

      const updater = setRowResults.calls.mostRecent().args[0];

      expect(updater({})).toEqual({ 1: { error: 'mail server unreachable' } });
    });

    itRedirectsHomeOn403({
      title: 'redirects home without touching row results on a 403',
      stub: (c) => c.sendRecoveryEmail,
      act: (controller) => controller.handleSendEmail(1),
      assertUntouched: () => expect(setRowResults).not.toHaveBeenCalled(),
    });
  });

  const listed = [
    { id: 1, username: 'foo', status: 'pending' },
    { id: 2, username: 'bar', status: 'approved' },
  ];

  const itReplacesTheRow = ({ title, stub, act, updated }) => {
    it(title, async () => {
      stub(client).and.resolveTo({ user: updated });
      const controller = buildController();

      await act(controller);

      const usersUpdater = setUsers.calls.mostRecent().args[0];

      expect(usersUpdater(listed)).toEqual([updated, listed[1]]);
      const rowUpdater = setRowResults.calls.mostRecent().args[0];

      expect(rowUpdater({ 1: { error: 'old' } })).toEqual({ 1: undefined });
    });
  };

  const itStoresTheRowError = ({ title, stub, act, error }) => {
    it(title, async () => {
      stub(client).and.rejectWith(error);
      const controller = buildController();

      await act(controller);

      const updater = setRowResults.calls.mostRecent().args[0];

      expect(updater({})).toEqual({ 1: { error: error.message } });
      expect(setUsers).not.toHaveBeenCalled();
    });
  };

  describe('#handleApprove', () => {
    it('calls the client with the user id', async () => {
      client.approveUser.and.resolveTo({ user: { ...listed[0], status: 'approved' } });
      const controller = buildController();

      await controller.handleApprove(1);

      expect(client.approveUser).toHaveBeenCalledWith(1);
    });

    itReplacesTheRow({
      title: 'replaces the user row with the approved account',
      stub: (c) => c.approveUser,
      act: (controller) => controller.handleApprove(1),
      updated: { ...listed[0], status: 'approved' },
    });

    itStoresTheRowError({
      title: 'stores a USER_NOT_PENDING message against the row',
      stub: (c) => c.approveUser,
      act: (controller) => controller.handleApprove(1),
      error: new ApiError(422, 'User is not pending', 'USER_NOT_PENDING'),
    });

    itRedirectsHomeOn403({
      title: 'redirects home without touching row results on a 403',
      stub: (c) => c.approveUser,
      act: (controller) => controller.handleApprove(1),
      assertUntouched: () => expect(setRowResults).not.toHaveBeenCalled(),
    });
  });

  describe('#handleDeny', () => {
    it('asks for confirmation before calling the client', async () => {
      client.denyUser.and.resolveTo({ user: { ...listed[0], status: 'denied' } });
      const controller = buildController();

      await controller.handleDeny(1);

      expect(confirm).toHaveBeenCalledWith(jasmine.any(String));
      expect(client.denyUser).toHaveBeenCalledWith(1);
    });

    it('does nothing when the confirmation is cancelled', async () => {
      confirm.and.returnValue(false);
      const controller = buildController();

      await controller.handleDeny(1);

      expect(client.denyUser).not.toHaveBeenCalled();
      expect(setUsers).not.toHaveBeenCalled();
      expect(setRowResults).not.toHaveBeenCalled();
    });

    itReplacesTheRow({
      title: 'replaces the user row with the denied account',
      stub: (c) => c.denyUser,
      act: (controller) => controller.handleDeny(1),
      updated: { ...listed[0], status: 'denied' },
    });

    itStoresTheRowError({
      title: 'stores a CANNOT_DENY_SELF message against the row',
      stub: (c) => c.denyUser,
      act: (controller) => controller.handleDeny(1),
      error: new ApiError(422, 'You cannot deny yourself', 'CANNOT_DENY_SELF'),
    });

    itStoresTheRowError({
      title: 'stores a DEFAULT_USER_MANAGED message against the row',
      stub: (c) => c.denyUser,
      act: (controller) => controller.handleDeny(1),
      error: new ApiError(409, 'The default user is managed by configuration', 'DEFAULT_USER_MANAGED'),
    });

    itRedirectsHomeOn403({
      title: 'redirects home without touching row results on a 403',
      stub: (c) => c.denyUser,
      act: (controller) => controller.handleDeny(1),
      assertUntouched: () => expect(setRowResults).not.toHaveBeenCalled(),
    });
  });

  describe('default confirm', () => {
    it('uses window.confirm', async () => {
      const fakeWindow = installFakeWindow({ confirm: jasmine.createSpy('confirm').and.returnValue(false) });
      const controller = new AdminUsersController(
        setUsers, setRowResults, setSearchError, setCurrentUserId, client,
      );

      await controller.handleDeny(1);

      expect(fakeWindow.confirm).toHaveBeenCalled();
      expect(client.denyUser).not.toHaveBeenCalled();
    });
  });
});
