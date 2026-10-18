import AwaitingApprovalController, {
  RECHECK_ERROR_MESSAGE,
} from '../../../../../../../assets/js/components/common/awaitingApproval/controllers/AwaitingApprovalController.js';
import HeaderController from '../../../../../../../assets/js/components/common/header/controllers/HeaderController.js';
import AccountsClient from '../../../../../../../assets/js/client/AccountsClient.js';
import AuthEvents from '../../../../../../../assets/js/client/AuthEvents.js';
import AuthSession from '../../../../../../../assets/js/client/AuthSession.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

describe('AwaitingApprovalController', () => {
  let setError;
  let client;
  let controller;

  beforeEach(() => {
    setError = jasmine.createSpy('setError');
    client = jasmine.createSpyObj('client', ['status', 'logout']);
    spyOn(AuthEvents, 'emit');
    controller = new AwaitingApprovalController(setError, client);
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  it('defaults to AccountsClient and a HeaderController over it', () => {
    const defaulted = new AwaitingApprovalController(setError);

    expect(defaulted.client).toBe(AccountsClient);
    expect(defaulted.headerController).toEqual(jasmine.any(HeaderController));
    expect(defaulted.headerController.client).toBe(AccountsClient);
  });

  describe('#checkAgain', () => {
    it('clears the error and re-checks status.json', async () => {
      client.status.and.resolveTo({ loggedIn: false, isAdmin: false, status: 'pending' });

      await controller.checkAgain();

      expect(setError).toHaveBeenCalledOnceWith(null);
      expect(client.status).toHaveBeenCalledTimes(1);
      expect(AuthEvents.emit).toHaveBeenCalledOnceWith(false, false, true);
    });

    it('emits the logged-in state when the account has been approved', async () => {
      client.status.and.resolveTo({ loggedIn: true, isAdmin: false });

      await controller.checkAgain();

      expect(AuthEvents.emit).toHaveBeenCalledOnceWith(true, false, false);
    });

    it('emits the plain logged-out state when the session is gone', async () => {
      client.status.and.resolveTo({ loggedIn: false, isAdmin: false });

      await controller.checkAgain();

      expect(AuthEvents.emit).toHaveBeenCalledOnceWith(false, false, false);
    });

    it('sets the re-check error when the request fails', async () => {
      client.status.and.rejectWith(new Error('network down'));

      await controller.checkAgain();

      expect(setError).toHaveBeenCalledWith(RECHECK_ERROR_MESSAGE);
      expect(AuthEvents.emit).not.toHaveBeenCalled();
    });
  });

  describe('#logout', () => {
    it("delegates to the header controller's logout with the error setter", async () => {
      const headerController = jasmine.createSpyObj('headerController', ['handleLogout']);
      headerController.handleLogout.and.resolveTo(true);

      const result = await new AwaitingApprovalController(setError, client, headerController).logout();

      expect(headerController.handleLogout).toHaveBeenCalledOnceWith(setError);
      expect(result).toBeTrue();
    });

    it('calls logoff and emits the logged-out state', async () => {
      spyOn(AuthSession, 'takeLegacyToken').and.returnValue(null);
      client.logout.and.resolveTo();
      installFakeWindow({ location: { hash: '' } });

      await controller.logout();

      expect(client.logout).toHaveBeenCalledTimes(1);
      expect(AuthEvents.emit).toHaveBeenCalledWith(false, false);
      expect(globalThis.window.location.hash).toBe('/');
    });
  });
});
