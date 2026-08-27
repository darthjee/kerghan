import HeaderController from '../../../../../../../assets/js/components/common/header/controllers/HeaderController.js';
import AuthSession from '../../../../../../../assets/js/client/AuthSession.js';

describe('HeaderController', () => {
  let client;

  beforeEach(() => {
    client = jasmine.createSpyObj('client', ['logout']);
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
  });
});
