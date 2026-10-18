import AuthStatus from '../../../../assets/js/client/AuthStatus.js';
import AuthEvents from '../../../../assets/js/client/AuthEvents.js';
import AccountsClient from '../../../../assets/js/client/AccountsClient.js';

describe('AuthStatus', () => {
  let client;

  beforeEach(() => {
    client = jasmine.createSpyObj('client', ['status']);
    spyOn(AuthEvents, 'emit');
  });

  describe('.refresh', () => {
    it('emits and returns the logged-in state for an approved session', async () => {
      client.status.and.resolveTo({ loggedIn: true, isAdmin: true });

      const state = await AuthStatus.refresh(client);

      expect(client.status).toHaveBeenCalledWith();
      expect(AuthEvents.emit).toHaveBeenCalledOnceWith(true, true, false);
      expect(state).toEqual({ loggedIn: true, isAdmin: true, pending: false });
    });

    it('emits the pending state with loggedIn and isAdmin false on a status: "pending" answer', async () => {
      client.status.and.resolveTo({ loggedIn: false, isAdmin: false, status: 'pending' });

      const state = await AuthStatus.refresh(client);

      expect(AuthEvents.emit).toHaveBeenCalledOnceWith(false, false, true);
      expect(state).toEqual({ loggedIn: false, isAdmin: false, pending: true });
    });

    it('emits the logged-out state for a plain logged-out answer', async () => {
      client.status.and.resolveTo({ loggedIn: false, isAdmin: false });

      await AuthStatus.refresh(client);

      expect(AuthEvents.emit).toHaveBeenCalledOnceWith(false, false, false);
    });

    it('propagates a failed status request without emitting', async () => {
      client.status.and.rejectWith(new Error('boom'));

      await expectAsync(AuthStatus.refresh(client)).toBeRejectedWithError('boom');
      expect(AuthEvents.emit).not.toHaveBeenCalled();
    });

    it('defaults to AccountsClient', async () => {
      spyOn(AccountsClient, 'status').and.resolveTo({ loggedIn: true, isAdmin: false });

      await AuthStatus.refresh();

      expect(AccountsClient.status).toHaveBeenCalled();
      expect(AuthEvents.emit).toHaveBeenCalledOnceWith(true, false, false);
    });
  });
});
