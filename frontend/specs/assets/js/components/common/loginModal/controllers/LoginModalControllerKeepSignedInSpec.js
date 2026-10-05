import LoginModalController from '../../../../../../../assets/js/components/common/loginModal/controllers/LoginModalController.js';
import AccountsClient from '../../../../../../../assets/js/client/AccountsClient.js';
import ApiClient from '../../../../../../../assets/js/client/ApiClient.js';
import AuthSession from '../../../../../../../assets/js/client/AuthSession.js';
import AuthEvents from '../../../../../../../assets/js/client/AuthEvents.js';
import LoginModalEvents from '../../../../../../../assets/js/client/LoginModalEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

describe('LoginModalController keepSignedIn', () => {
  let setFields;
  let client;

  const build = (clientOverride = client) => new LoginModalController(
    jasmine.createSpy('setMode'),
    setFields,
    jasmine.createSpy('setFieldErrors'),
    jasmine.createSpy('setSubmitError'),
    jasmine.createSpy('setResultPanel'),
    jasmine.createSpy('setDeviceExpiresAt'),
    clientOverride,
  );

  beforeEach(() => {
    setFields = jasmine.createSpy('setFields');
    client = jasmine.createSpyObj('client', ['login', 'register', 'createAuthorizationRequest']);
    spyOn(AuthEvents, 'emit');
    spyOn(LoginModalEvents, 'close');
    installFakeWindow({ location: { hash: '' } });
  });

  afterEach(() => {
    uninstallFakeWindow();
    AuthSession.clear();
  });

  describe('#setKeepSignedIn', () => {
    it('updates only the keepSignedIn field', () => {
      build().setKeepSignedIn(true);

      const updater = setFields.calls.mostRecent().args[0];

      expect(updater({ username: 'foo', keepSignedIn: false }))
        .toEqual({ username: 'foo', keepSignedIn: true });
    });
  });

  describe('#switchMode', () => {
    it('resets keepSignedIn to false', () => {
      build().switchMode('device');

      expect(setFields).toHaveBeenCalledWith(jasmine.objectContaining({ keepSignedIn: false }));
    });
  });

  describe('#handleSubmit', () => {
    it('logs in with keepSignedIn set in password mode', async () => {
      const fields = { username: 'foo', password: 'secret', keepSignedIn: true };
      client.login.and.resolveTo({ user: { isAdmin: false } });

      await build().handleSubmit('password', fields);

      expect(client.login).toHaveBeenCalledWith(jasmine.objectContaining({ keepSignedIn: true }));
    });

    it('opens the authorization request with keepSignedIn in device mode', async () => {
      client.createAuthorizationRequest.and.rejectWith(new Error('rate limited'));

      await build().handleSubmit('device', { username: 'foo', keepSignedIn: true });

      expect(client.createAuthorizationRequest).toHaveBeenCalledWith('foo', true);
    });

    it('never sends keepSignedIn when registering', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ user: { isAdmin: false }, refreshToken: 't' });

      await build(AccountsClient).handleSubmit('register', {
        username: 'foo',
        email: 'foo@example.com',
        password: 'secret',
        passwordConfirmation: 'secret',
        keepSignedIn: true,
      });

      const [, body] = ApiClient.postJson.calls.mostRecent().args;

      expect(ApiClient.postJson).toHaveBeenCalledWith('/auth/register.json', jasmine.any(Object));
      expect(Object.keys(body)).not.toContain('keepSignedIn');
    });
  });
});
