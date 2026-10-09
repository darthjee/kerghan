import HeaderController, { LOGOUT_ERROR_MESSAGE } from '../../../../../../../assets/js/components/common/header/controllers/HeaderController.js';
import AuthSession from '../../../../../../../assets/js/client/AuthSession.js';
import AuthEvents from '../../../../../../../assets/js/client/AuthEvents.js';
import LoginModalEvents from '../../../../../../../assets/js/client/LoginModalEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

describe('HeaderController', () => {
  let client;
  let controller;

  beforeEach(() => {
    client = jasmine.createSpyObj('client', ['logout', 'status', 'migrateLegacyToken']);
    controller = new HeaderController(client);
    spyOn(AuthEvents, 'emit');
  });

  describe('#handleLogout', () => {
    let fakeWindow;

    beforeEach(() => {
      fakeWindow = installFakeWindow({ location: { hash: '' } });
    });

    afterEach(() => {
      uninstallFakeWindow();
    });

    it('logs out without passing any token', async () => {
      client.logout.and.resolveTo();

      await controller.handleLogout();

      expect(client.logout).toHaveBeenCalledWith();
    });

    it('redirects home on success', async () => {
      client.logout.and.resolveTo();

      await controller.handleLogout();

      expect(fakeWindow.location.hash).toBe('/');
    });

    it('emits the logged-out auth state', async () => {
      client.logout.and.resolveTo();

      await controller.handleLogout();

      expect(AuthEvents.emit).toHaveBeenCalledWith(false, false);
    });

    it('resolves true and clears any previous error on success', async () => {
      const onError = jasmine.createSpy('onError');
      client.logout.and.resolveTo();

      const result = await controller.handleLogout(onError);

      expect(result).toBeTrue();
      expect(onError.calls.allArgs()).toEqual([[null]]);
    });

    it('removes the legacy localStorage refresh token', async () => {
      AuthSession.storage().setItem('kerghan_refresh_token', 'legacy-token');
      client.logout.and.resolveTo();

      await controller.handleLogout();

      expect(AuthSession.storage().getItem('kerghan_refresh_token')).toBeNull();
    });

    describe('when the logout request fails', () => {
      beforeEach(() => {
        client.logout.and.rejectWith(new Error('network error'));
      });

      it('does not redirect home', async () => {
        await controller.handleLogout();

        expect(fakeWindow.location.hash).toBe('');
      });

      it('does not emit the logged-out auth state', async () => {
        await controller.handleLogout();

        expect(AuthEvents.emit).not.toHaveBeenCalled();
      });

      it('reports the sign-out error so the user can retry', async () => {
        const onError = jasmine.createSpy('onError');

        await controller.handleLogout(onError);

        expect(onError.calls.allArgs()).toEqual([[null], [LOGOUT_ERROR_MESSAGE]]);
        expect(LOGOUT_ERROR_MESSAGE).toBe('Could not sign out, please try again.');
      });

      it('resolves false', async () => {
        expect(await controller.handleLogout()).toBeFalse();
      });

      it('still removes the legacy localStorage refresh token', async () => {
        AuthSession.storage().setItem('kerghan_refresh_token', 'legacy-token');

        await controller.handleLogout();

        expect(AuthSession.storage().getItem('kerghan_refresh_token')).toBeNull();
      });
    });
  });

  describe('#openLoginModal', () => {
    it('opens the login modal in the given mode via LoginModalEvents', () => {
      spyOn(LoginModalEvents, 'open');

      controller.openLoginModal('register');

      expect(LoginModalEvents.open).toHaveBeenCalledWith('register');
    });
  });

  describe('#migrateIfNeeded', () => {
    it('does not call the backend when there is no legacy token', async () => {
      spyOn(AuthSession, 'takeLegacyToken').and.returnValue(null);

      await controller.migrateIfNeeded();

      expect(client.migrateLegacyToken).not.toHaveBeenCalled();
    });

    it('migrates the legacy token when one is present', async () => {
      spyOn(AuthSession, 'takeLegacyToken').and.returnValue('legacy-token');
      client.migrateLegacyToken.and.resolveTo(true);

      await controller.migrateIfNeeded();

      expect(client.migrateLegacyToken).toHaveBeenCalledWith('legacy-token');
    });

    it('runs at most once, since the legacy token is removed when taken', async () => {
      AuthSession.storage().setItem('kerghan_refresh_token', 'legacy-token');
      client.migrateLegacyToken.and.resolveTo(false);

      await controller.migrateIfNeeded();
      await controller.migrateIfNeeded();

      expect(client.migrateLegacyToken).toHaveBeenCalledTimes(1);
    });
  });

  describe('#checkStatus', () => {
    beforeEach(() => {
      spyOn(AuthSession, 'takeLegacyToken').and.returnValue(null);
    });

    it('emits false/false without calling the backend when the hint cookie is absent', async () => {
      spyOn(AuthSession, 'isLoggedIn').and.returnValue(false);

      await controller.checkStatus();

      expect(client.status).not.toHaveBeenCalled();
      expect(AuthEvents.emit).toHaveBeenCalledWith(false, false);
    });

    it('emits the backend-confirmed state and admin flag when the hint cookie is present', async () => {
      spyOn(AuthSession, 'isLoggedIn').and.returnValue(true);
      client.status.and.resolveTo({ loggedIn: true, isAdmin: true });

      await controller.checkStatus();

      expect(client.status).toHaveBeenCalledWith();
      expect(AuthEvents.emit).toHaveBeenCalledWith(true, true);
    });

    it('emits false when the backend reports the session is no longer active', async () => {
      spyOn(AuthSession, 'isLoggedIn').and.returnValue(true);
      client.status.and.resolveTo({ loggedIn: false, isAdmin: false });

      await controller.checkStatus();

      expect(AuthEvents.emit).toHaveBeenCalledWith(false, false);
    });

    it('runs the migration before reading the hint cookie', async () => {
      const order = [];
      spyOn(controller, 'migrateIfNeeded').and.callFake(async () => order.push('migrate'));
      spyOn(AuthSession, 'isLoggedIn').and.callFake(() => {
        order.push('isLoggedIn');
        return true;
      });
      client.status.and.resolveTo({ loggedIn: true, isAdmin: false });

      await controller.checkStatus();

      expect(order).toEqual(['migrate', 'isLoggedIn']);
      expect(AuthEvents.emit).toHaveBeenCalledWith(true, false);
    });
  });
});
