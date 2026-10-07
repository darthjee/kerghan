import SessionsController from '../../../../../../../../assets/js/components/resources/accounts/pages/controllers/SessionsController.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';

describe('SessionsController', () => {
  let setSessions;
  let setLoadError;
  let setRowState;
  let setPageState;
  let client;

  const sessions = [{
    id: 'session-uuid',
    startedAt: '2026-10-01T00:00:00.000Z',
    lastUsedAt: '2026-10-02T00:00:00.000Z',
    keepSignedIn: false,
    current: false,
  }];

  beforeEach(() => {
    setSessions = jasmine.createSpy('setSessions');
    setLoadError = jasmine.createSpy('setLoadError');
    setRowState = jasmine.createSpy('setRowState');
    setPageState = jasmine.createSpy('setPageState');
    client = jasmine.createSpyObj('client', [
      'listSessions',
      'revokeSession',
      'revokeOtherSessions',
    ]);
  });

  const buildController = () => new SessionsController(
    setSessions,
    setLoadError,
    setRowState,
    setPageState,
    client,
  );

  describe('#load', () => {
    it('stores the returned sessions and clears the load error', async () => {
      client.listSessions.and.resolveTo({ sessions });

      await buildController().load();

      expect(setSessions).toHaveBeenCalledWith(sessions);
      expect(setLoadError).toHaveBeenCalledWith(null);
    });

    it('sets a load error when the request fails', async () => {
      client.listSessions.and.rejectWith(new Error('network error'));

      await buildController().load();

      expect(setLoadError).toHaveBeenCalledWith('network error');
      expect(setSessions).not.toHaveBeenCalled();
    });

    it('does nothing when the session turned out to be expired', async () => {
      client.listSessions.and.resolveTo(undefined);

      await buildController().load();

      expect(setSessions).not.toHaveBeenCalled();
      expect(setLoadError).not.toHaveBeenCalled();
    });
  });

  describe('#revoke', () => {
    it('clears the row error and reloads the list on success', async () => {
      client.revokeSession.and.resolveTo({ revoked: true });
      client.listSessions.and.resolveTo({ sessions: [] });

      await buildController().revoke('session-uuid');

      expect(client.revokeSession).toHaveBeenCalledWith('session-uuid');
      const updater = setRowState.calls.first().args[0];
      expect(updater(new Map())).toEqual(new Map([['session-uuid', { error: null }]]));
      expect(setSessions).toHaveBeenCalledWith([]);
    });

    it('stores the error against the row and does not reload on failure', async () => {
      client.revokeSession.and.rejectWith(new ApiError(404, 'Session not found'));

      await buildController().revoke('session-uuid');

      const updater = setRowState.calls.mostRecent().args[0];
      expect(updater(new Map())).toEqual(
        new Map([['session-uuid', { error: 'Session not found' }]]),
      );
      expect(client.listSessions).not.toHaveBeenCalled();
    });

    it('does nothing when the session turned out to be expired', async () => {
      client.revokeSession.and.resolveTo(undefined);

      await buildController().revoke('session-uuid');

      expect(setRowState).not.toHaveBeenCalled();
      expect(client.listSessions).not.toHaveBeenCalled();
    });
  });

  describe('#requestRevokeOthers', () => {
    it('opens the confirmation and clears the page error', () => {
      buildController().requestRevokeOthers();

      expect(setPageState).toHaveBeenCalledWith({ confirmingRevokeOthers: true, error: null });
    });
  });

  describe('#cancelRevokeOthers', () => {
    it('closes the confirmation and clears the page error', () => {
      buildController().cancelRevokeOthers();

      expect(setPageState).toHaveBeenCalledWith({ confirmingRevokeOthers: false, error: null });
    });
  });

  describe('#confirmRevokeOthers', () => {
    it('closes the confirmation and reloads the list on success', async () => {
      client.revokeOtherSessions.and.resolveTo({ revoked: true });
      client.listSessions.and.resolveTo({ sessions });

      await buildController().confirmRevokeOthers();

      expect(setPageState).toHaveBeenCalledWith({ confirmingRevokeOthers: false, error: null });
      expect(setSessions).toHaveBeenCalledWith(sessions);
    });

    it('closes the confirmation and stores the page error on failure', async () => {
      client.revokeOtherSessions.and.rejectWith(new ApiError(500, 'Server error'));

      await buildController().confirmRevokeOthers();

      expect(setPageState).toHaveBeenCalledWith({
        confirmingRevokeOthers: false,
        error: 'Server error',
      });
      expect(client.listSessions).not.toHaveBeenCalled();
    });

    it('does nothing when the session turned out to be expired', async () => {
      client.revokeOtherSessions.and.resolveTo(undefined);

      await buildController().confirmRevokeOthers();

      expect(setPageState).not.toHaveBeenCalled();
      expect(client.listSessions).not.toHaveBeenCalled();
    });
  });

  describe('#patchRow', () => {
    const applyPatch = (current, id, patch) => {
      buildController().patchRow(id, patch);

      return setRowState.calls.mostRecent().args[0](current);
    };

    it('merges the patch into an existing row, keeping its other fields', () => {
      const current = new Map([['session-uuid', { other: 1, error: 'old' }]]);

      expect(applyPatch(current, 'session-uuid', { error: null })).toEqual(
        new Map([['session-uuid', { other: 1, error: null }]]),
      );
    });

    it('returns a new Map without mutating the current one', () => {
      const current = new Map([['session-uuid', { error: 'old' }]]);

      const result = applyPatch(current, 'session-uuid', { error: null });

      expect(result).not.toBe(current);
      expect(current).toEqual(new Map([['session-uuid', { error: 'old' }]]));
    });
  });
});
