import LoginModalController from '../../../../../../../assets/js/components/common/loginModal/controllers/LoginModalController.js';
import AuthEvents from '../../../../../../../assets/js/client/AuthEvents.js';
import LoginModalEvents from '../../../../../../../assets/js/client/LoginModalEvents.js';

describe('LoginModalController', () => {
  let setMode;
  let setFields;
  let setFieldErrors;
  let setSubmitError;
  let client;

  const passwordFields = { username: 'foo', password: 'secret' };
  const registerFields = {
    username: 'foo', email: 'foo@example.com', password: 'secret', passwordConfirmation: 'secret',
  };

  const build = () => new LoginModalController(
    setMode, setFields, setFieldErrors, setSubmitError, client,
  );

  beforeEach(() => {
    setMode = jasmine.createSpy('setMode');
    setFields = jasmine.createSpy('setFields');
    setFieldErrors = jasmine.createSpy('setFieldErrors');
    setSubmitError = jasmine.createSpy('setSubmitError');
    client = jasmine.createSpyObj('client', ['login', 'register']);
    spyOn(AuthEvents, 'emit');
    spyOn(LoginModalEvents, 'close');
  });

  describe('#switchMode', () => {
    it('sets the new mode and resets every form field', () => {
      build().switchMode('register');

      expect(setMode).toHaveBeenCalledWith('register');
      expect(setFields).toHaveBeenCalledWith({
        username: '', email: '', password: '', passwordConfirmation: '',
      });
    });

    it('clears both field errors and the submit error', () => {
      build().switchMode('password');

      expect(setFieldErrors).toHaveBeenCalledWith({});
      expect(setSubmitError).toHaveBeenCalledWith(null);
    });
  });

  describe('#handleSubmit password mode', () => {
    it('clears the submit error and logs in with the current fields', async () => {
      client.login.and.resolveTo({ user: { id: 1, username: 'foo', isAdmin: false }, refreshToken: 't' });
      const fakeWindow = { location: { hash: '' } };
      globalThis.window = fakeWindow;

      try {
        await build().handleSubmit('password', passwordFields);

        expect(setSubmitError).toHaveBeenCalledWith(null);
        expect(client.login).toHaveBeenCalledWith(passwordFields);
      } finally {
        delete globalThis.window;
      }
    });

    it('runs the shared success path once on success', async () => {
      client.login.and.resolveTo({ user: { id: 1, username: 'foo', isAdmin: true }, refreshToken: 't' });
      const fakeWindow = { location: { hash: '' } };
      globalThis.window = fakeWindow;

      try {
        await build().handleSubmit('password', passwordFields);

        expect(AuthEvents.emit).toHaveBeenCalledOnceWith(true, true);
        expect(LoginModalEvents.close).toHaveBeenCalledTimes(1);
        expect(fakeWindow.location.hash).toBe('/');
      } finally {
        delete globalThis.window;
      }
    });

    it('sets a submit error and skips the success path when the request fails', async () => {
      client.login.and.rejectWith(new Error('invalid credentials'));

      await build().handleSubmit('password', passwordFields);

      expect(setSubmitError).toHaveBeenCalledWith('invalid credentials');
      expect(AuthEvents.emit).not.toHaveBeenCalled();
      expect(LoginModalEvents.close).not.toHaveBeenCalled();
    });
  });

  describe('#handleSubmit register mode', () => {
    it('sets field errors and skips the API call when the form is invalid', async () => {
      await build().handleSubmit('register', { ...registerFields, email: 'nope' });

      expect(setFieldErrors).toHaveBeenCalledWith(jasmine.objectContaining({ email: jasmine.any(String) }));
      expect(client.register).not.toHaveBeenCalled();
    });

    it('registers and runs the shared success path once on a clean form', async () => {
      client.register.and.resolveTo({ user: { id: 1, username: 'foo', isAdmin: false }, refreshToken: 't' });
      const fakeWindow = { location: { hash: '' } };
      globalThis.window = fakeWindow;

      try {
        await build().handleSubmit('register', registerFields);

        expect(setFieldErrors).toHaveBeenCalledWith({});
        expect(client.register).toHaveBeenCalledWith(registerFields);
        expect(AuthEvents.emit).toHaveBeenCalledOnceWith(true, false);
        expect(LoginModalEvents.close).toHaveBeenCalledTimes(1);
        expect(fakeWindow.location.hash).toBe('/');
      } finally {
        delete globalThis.window;
      }
    });

    it('sets a submit error when the register request fails', async () => {
      client.register.and.rejectWith(new Error('username is not available'));

      await build().handleSubmit('register', registerFields);

      expect(setSubmitError).toHaveBeenCalledWith('username is not available');
      expect(AuthEvents.emit).not.toHaveBeenCalled();
    });
  });
});
