import RegisterController from '../../../../../../../../assets/js/components/resources/accounts/pages/controllers/RegisterController.js';
import AuthEvents from '../../../../../../../../assets/js/client/AuthEvents.js';

describe('RegisterController', () => {
  let setFieldErrors;
  let setSubmitError;
  let client;

  const validFields = {
    username: 'foo', email: 'foo@example.com', password: 'secret', passwordConfirmation: 'secret',
  };

  beforeEach(() => {
    setFieldErrors = jasmine.createSpy('setFieldErrors');
    setSubmitError = jasmine.createSpy('setSubmitError');
    client = jasmine.createSpyObj('client', ['register']);
    spyOn(AuthEvents, 'emit');
  });

  describe('#validate', () => {
    it('returns no errors for a valid form', () => {
      const controller = new RegisterController(setFieldErrors, setSubmitError, client);

      expect(controller.validate(validFields)).toEqual({});
    });

    it('flags a missing username', () => {
      const controller = new RegisterController(setFieldErrors, setSubmitError, client);

      expect(controller.validate({ ...validFields, username: '' }).username).toBeDefined();
    });

    it('flags a missing email', () => {
      const controller = new RegisterController(setFieldErrors, setSubmitError, client);

      expect(controller.validate({ ...validFields, email: '' }).email).toBeDefined();
    });

    it('flags a malformed email', () => {
      const controller = new RegisterController(setFieldErrors, setSubmitError, client);

      expect(controller.validate({ ...validFields, email: 'not-an-email' }).email).toBeDefined();
    });

    it('flags a missing password', () => {
      const controller = new RegisterController(setFieldErrors, setSubmitError, client);

      expect(controller.validate({ ...validFields, password: '' }).password).toBeDefined();
    });

    it('flags a missing password confirmation', () => {
      const controller = new RegisterController(setFieldErrors, setSubmitError, client);

      expect(
        controller.validate({ ...validFields, passwordConfirmation: '' }).passwordConfirmation,
      ).toBeDefined();
    });

    it('flags a mismatched password confirmation', () => {
      const controller = new RegisterController(setFieldErrors, setSubmitError, client);

      expect(
        controller.validate({ ...validFields, passwordConfirmation: 'other' }).passwordConfirmation,
      ).toBeDefined();
    });
  });

  describe('#handleSubmit', () => {
    it('sets field errors and skips the API call when the form is invalid', async () => {
      const controller = new RegisterController(setFieldErrors, setSubmitError, client);

      await controller.handleSubmit({ ...validFields, username: '' });

      expect(setFieldErrors).toHaveBeenCalledWith(jasmine.objectContaining({ username: jasmine.any(String) }));
      expect(client.register).not.toHaveBeenCalled();
    });

    it('clears field errors and redirects home on success', async () => {
      client.register.and.resolveTo({
        user: {
          id: 1, username: 'foo', email: 'foo@example.com', isAdmin: false,
        },
        refreshToken: 'refresh-token',
      });
      const controller = new RegisterController(setFieldErrors, setSubmitError, client);
      const fakeWindow = { location: { hash: '' } };

      globalThis.window = fakeWindow;

      try {
        await controller.handleSubmit(validFields);

        expect(setFieldErrors).toHaveBeenCalledWith({});
        expect(client.register).toHaveBeenCalledWith(validFields);
        expect(setSubmitError).toHaveBeenCalledWith(null);
        expect(fakeWindow.location.hash).toBe('/');
      } finally {
        delete globalThis.window;
      }
    });

    it('emits the logged-in auth state on success', async () => {
      client.register.and.resolveTo({
        user: {
          id: 1, username: 'foo', email: 'foo@example.com', isAdmin: true,
        },
        refreshToken: 'refresh-token',
      });
      const controller = new RegisterController(setFieldErrors, setSubmitError, client);
      const fakeWindow = { location: { hash: '' } };

      globalThis.window = fakeWindow;

      try {
        await controller.handleSubmit(validFields);

        expect(AuthEvents.emit).toHaveBeenCalledWith(true, true);
      } finally {
        delete globalThis.window;
      }
    });

    it('sets a submit error when the request fails', async () => {
      client.register.and.rejectWith(new Error('username is not available'));
      const controller = new RegisterController(setFieldErrors, setSubmitError, client);

      await controller.handleSubmit(validFields);

      expect(setSubmitError).toHaveBeenCalledWith('username is not available');
    });
  });
});
