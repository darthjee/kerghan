import LoginController from '../../../../../../../../assets/js/components/resources/accounts/pages/controllers/LoginController.js';

describe('LoginController', () => {
  let setSubmitError;
  let client;

  const fields = { username: 'foo', password: 'secret' };

  beforeEach(() => {
    setSubmitError = jasmine.createSpy('setSubmitError');
    client = jasmine.createSpyObj('client', ['login']);
  });

  describe('#handleSubmit', () => {
    it('clears the submit error and logs in with the current fields', async () => {
      client.login.and.resolveTo({ user: { id: 1, username: 'foo' }, refreshToken: 'token' });
      const controller = new LoginController(setSubmitError, client);
      const fakeWindow = { location: { hash: '' } };

      globalThis.window = fakeWindow;

      try {
        await controller.handleSubmit(fields);

        expect(setSubmitError).toHaveBeenCalledWith(null);
        expect(client.login).toHaveBeenCalledWith(fields);
      } finally {
        delete globalThis.window;
      }
    });

    it('redirects home on success', async () => {
      client.login.and.resolveTo({ user: { id: 1, username: 'foo' }, refreshToken: 'token' });
      const controller = new LoginController(setSubmitError, client);
      const fakeWindow = { location: { hash: '' } };

      globalThis.window = fakeWindow;

      try {
        await controller.handleSubmit(fields);

        expect(fakeWindow.location.hash).toBe('/');
      } finally {
        delete globalThis.window;
      }
    });

    it('sets a submit error when the request fails', async () => {
      client.login.and.rejectWith(new Error('invalid credentials'));
      const controller = new LoginController(setSubmitError, client);

      await controller.handleSubmit(fields);

      expect(setSubmitError).toHaveBeenCalledWith('invalid credentials');
    });
  });
});
