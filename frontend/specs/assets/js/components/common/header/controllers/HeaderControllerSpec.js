import HeaderController from '../../../../../../../assets/js/components/common/header/controllers/HeaderController.js';
import AuthSession from '../../../../../../../assets/js/client/AuthSession.js';
import AuthEvents from '../../../../../../../assets/js/client/AuthEvents.js';

describe('HeaderController', () => {
  let client;

  beforeEach(() => {
    client = jasmine.createSpyObj('client', ['logout', 'status']);
    spyOn(AuthEvents, 'emit');
  });

  afterEach(() => {
    AuthSession.clear();
  });

  describe('#handleLogout', () => {
    it('logs out with the currently stored refresh token', async () => {
      AuthSession.set('refresh-token');
      client.logout.and.resolveTo();
      const controller = new HeaderController(client);
      const fakeWindow = { location: { hash: '' } };

      globalThis.window = fakeWindow;

      try {
        await controller.handleLogout();

        expect(client.logout).toHaveBeenCalledWith('refresh-token');
      } finally {
        delete globalThis.window;
      }
    });

    it('redirects home on success', async () => {
      client.logout.and.resolveTo();
      const controller = new HeaderController(client);
      const fakeWindow = { location: { hash: '' } };

      globalThis.window = fakeWindow;

      try {
        await controller.handleLogout();

        expect(fakeWindow.location.hash).toBe('/');
      } finally {
        delete globalThis.window;
      }
    });

    it('redirects home even when the logout request fails', async () => {
      client.logout.and.rejectWith(new Error('network error'));
      const controller = new HeaderController(client);
      const fakeWindow = { location: { hash: '' } };

      globalThis.window = fakeWindow;

      try {
        await controller.handleLogout();

        expect(fakeWindow.location.hash).toBe('/');
      } finally {
        delete globalThis.window;
      }
    });

    it('emits the logged-out auth state', async () => {
      client.logout.and.resolveTo();
      const controller = new HeaderController(client);
      const fakeWindow = { location: { hash: '' } };

      globalThis.window = fakeWindow;

      try {
        await controller.handleLogout();

        expect(AuthEvents.emit).toHaveBeenCalledWith(false, false);
      } finally {
        delete globalThis.window;
      }
    });

    it('emits the logged-out auth state even when the logout request fails', async () => {
      client.logout.and.rejectWith(new Error('network error'));
      const controller = new HeaderController(client);
      const fakeWindow = { location: { hash: '' } };

      globalThis.window = fakeWindow;

      try {
        await controller.handleLogout();

        expect(AuthEvents.emit).toHaveBeenCalledWith(false, false);
      } finally {
        delete globalThis.window;
      }
    });
  });

  describe('#checkStatus', () => {
    it('emits false/false without calling the backend when there is no stored token', async () => {
      const controller = new HeaderController(client);

      await controller.checkStatus();

      expect(client.status).not.toHaveBeenCalled();
      expect(AuthEvents.emit).toHaveBeenCalledWith(false, false);
    });

    it('emits true and the admin flag, leaving the stored token untouched, when it is still active', async () => {
      AuthSession.set('refresh-token');
      client.status.and.resolveTo({ loggedIn: true, isAdmin: true });
      const controller = new HeaderController(client);

      await controller.checkStatus();

      expect(client.status).toHaveBeenCalledWith('refresh-token');
      expect(AuthSession.get()).toBe('refresh-token');
      expect(AuthEvents.emit).toHaveBeenCalledWith(true, true);
    });

    it('clears the stored token and emits false when it is no longer active', async () => {
      AuthSession.set('refresh-token');
      client.status.and.resolveTo({ loggedIn: false, isAdmin: false });
      const controller = new HeaderController(client);

      await controller.checkStatus();

      expect(AuthSession.get()).toBeNull();
      expect(AuthEvents.emit).toHaveBeenCalledWith(false, false);
    });
  });
});
