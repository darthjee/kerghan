import AuthorizationRequestsController from '../../../../../../../../assets/js/components/resources/accounts/pages/controllers/AuthorizationRequestsController.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';

describe('AuthorizationRequestsController', () => {
  let setRequests;
  let setLoadError;
  let setRowState;
  let client;

  const requests = [{
    uuid: 'req-uuid',
    requestIp: '127.0.0.1',
    requestUserAgent: 'Mozilla/5.0',
    createdAt: '2026-09-09T00:00:00.000Z',
    expiresAt: '2026-09-09T01:00:00.000Z',
  }];

  beforeEach(() => {
    setRequests = jasmine.createSpy('setRequests');
    setLoadError = jasmine.createSpy('setLoadError');
    setRowState = jasmine.createSpy('setRowState');
    client = jasmine.createSpyObj('client', [
      'listAuthorizationRequests',
      'authorizeAuthorizationRequest',
      'denyAuthorizationRequest',
    ]);
  });

  const buildController = () => new AuthorizationRequestsController(
    setRequests,
    setLoadError,
    setRowState,
    client,
  );

  describe('#load', () => {
    it('stores the returned requests and clears the load error', async () => {
      client.listAuthorizationRequests.and.resolveTo({ requests });
      const controller = buildController();

      await controller.load();

      expect(setRequests).toHaveBeenCalledWith(requests);
      expect(setLoadError).toHaveBeenCalledWith(null);
    });

    it('sets a load error when the request fails', async () => {
      client.listAuthorizationRequests.and.rejectWith(new Error('network error'));
      const controller = buildController();

      await controller.load();

      expect(setLoadError).toHaveBeenCalledWith('network error');
      expect(setRequests).not.toHaveBeenCalled();
    });

    it('does nothing when the session turned out to be expired', async () => {
      client.listAuthorizationRequests.and.resolveTo(undefined);
      const controller = buildController();

      await controller.load();

      expect(setRequests).not.toHaveBeenCalled();
      expect(setLoadError).not.toHaveBeenCalled();
    });
  });

  describe('#authorize', () => {
    it('clears the row error and reloads the list on success', async () => {
      client.authorizeAuthorizationRequest.and.resolveTo({ authorized: true });
      client.listAuthorizationRequests.and.resolveTo({ requests });
      const controller = buildController();

      await controller.authorize('req-uuid', 'secret');

      expect(client.authorizeAuthorizationRequest).toHaveBeenCalledWith('req-uuid', 'secret');
      const updater = setRowState.calls.first().args[0];
      expect(updater({})).toEqual({ 'req-uuid': { error: null } });
      expect(client.listAuthorizationRequests).toHaveBeenCalled();
      expect(setRequests).toHaveBeenCalledWith(requests);
    });

    it('stores the error against the row and does not reload on a 400', async () => {
      client.authorizeAuthorizationRequest.and.rejectWith(new ApiError(400, 'Invalid password'));
      const controller = buildController();

      await controller.authorize('req-uuid', 'wrong');

      const updater = setRowState.calls.mostRecent().args[0];
      expect(updater({ 'req-uuid': { open: true, password: 'wrong' } })).toEqual({
        'req-uuid': { open: true, password: 'wrong', error: 'Invalid password' },
      });
      expect(client.listAuthorizationRequests).not.toHaveBeenCalled();
    });

    it('does nothing when the session turned out to be expired', async () => {
      client.authorizeAuthorizationRequest.and.resolveTo(undefined);
      const controller = buildController();

      await controller.authorize('req-uuid', 'secret');

      expect(setRowState).not.toHaveBeenCalled();
      expect(client.listAuthorizationRequests).not.toHaveBeenCalled();
    });
  });

  describe('#deny', () => {
    it('clears the row error and reloads the list on success', async () => {
      client.denyAuthorizationRequest.and.resolveTo({ denied: true });
      client.listAuthorizationRequests.and.resolveTo({ requests });
      const controller = buildController();

      await controller.deny('req-uuid');

      expect(client.denyAuthorizationRequest).toHaveBeenCalledWith('req-uuid');
      const updater = setRowState.calls.first().args[0];
      expect(updater({})).toEqual({ 'req-uuid': { error: null } });
      expect(client.listAuthorizationRequests).toHaveBeenCalled();
      expect(setRequests).toHaveBeenCalledWith(requests);
    });

    it('stores the error against the row and does not reload on a 400', async () => {
      client.denyAuthorizationRequest.and.rejectWith(new ApiError(400, 'Request already resolved'));
      const controller = buildController();

      await controller.deny('req-uuid');

      const updater = setRowState.calls.mostRecent().args[0];
      expect(updater({})).toEqual({ 'req-uuid': { error: 'Request already resolved' } });
      expect(client.listAuthorizationRequests).not.toHaveBeenCalled();
    });

    it('does nothing when the session turned out to be expired', async () => {
      client.denyAuthorizationRequest.and.resolveTo(undefined);
      const controller = buildController();

      await controller.deny('req-uuid');

      expect(setRowState).not.toHaveBeenCalled();
      expect(client.listAuthorizationRequests).not.toHaveBeenCalled();
    });
  });
});
