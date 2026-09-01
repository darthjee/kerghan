import ResetPasswordController from '../../../../../../../../assets/js/components/resources/accounts/pages/controllers/ResetPasswordController.js';

describe('ResetPasswordController', () => {
  let setFieldErrors;
  let setSubmitError;
  let setResetDone;
  let client;

  const token = 'reset-token';
  const validFields = { password: 'secret', passwordConfirmation: 'secret' };

  beforeEach(() => {
    setFieldErrors = jasmine.createSpy('setFieldErrors');
    setSubmitError = jasmine.createSpy('setSubmitError');
    setResetDone = jasmine.createSpy('setResetDone');
    client = jasmine.createSpyObj('client', ['resetPassword']);
  });

  describe('#validate', () => {
    it('returns no errors for a valid form', () => {
      const controller = new ResetPasswordController(setFieldErrors, setSubmitError, setResetDone, client);

      expect(controller.validate(validFields)).toEqual({});
    });

    it('flags a missing password', () => {
      const controller = new ResetPasswordController(setFieldErrors, setSubmitError, setResetDone, client);

      expect(controller.validate({ ...validFields, password: '' }).password).toBeDefined();
    });

    it('flags a missing password confirmation', () => {
      const controller = new ResetPasswordController(setFieldErrors, setSubmitError, setResetDone, client);

      expect(
        controller.validate({ ...validFields, passwordConfirmation: '' }).passwordConfirmation,
      ).toBeDefined();
    });

    it('flags a mismatched password confirmation', () => {
      const controller = new ResetPasswordController(setFieldErrors, setSubmitError, setResetDone, client);

      expect(
        controller.validate({ ...validFields, passwordConfirmation: 'other' }).passwordConfirmation,
      ).toBeDefined();
    });
  });

  describe('#handleSubmit', () => {
    it('sets field errors and skips the API call when the form is invalid', async () => {
      const controller = new ResetPasswordController(setFieldErrors, setSubmitError, setResetDone, client);

      await controller.handleSubmit(token, { ...validFields, password: '' });

      expect(setFieldErrors).toHaveBeenCalledWith(jasmine.objectContaining({ password: jasmine.any(String) }));
      expect(client.resetPassword).not.toHaveBeenCalled();
    });

    it('clears field errors and flips to the reset-done state on success', async () => {
      client.resetPassword.and.resolveTo({ reset: true });
      const controller = new ResetPasswordController(setFieldErrors, setSubmitError, setResetDone, client);

      await controller.handleSubmit(token, validFields);

      expect(setFieldErrors).toHaveBeenCalledWith({});
      expect(client.resetPassword).toHaveBeenCalledWith({ token, ...validFields });
      expect(setSubmitError).toHaveBeenCalledWith(null);
      expect(setResetDone).toHaveBeenCalledWith(true);
    });

    it('sets a submit error when the request fails', async () => {
      client.resetPassword.and.rejectWith(new Error('Invalid or expired token'));
      const controller = new ResetPasswordController(setFieldErrors, setSubmitError, setResetDone, client);

      await controller.handleSubmit(token, validFields);

      expect(setSubmitError).toHaveBeenCalledWith('Invalid or expired token');
    });

    it('does not flip to the reset-done state when the request fails', async () => {
      client.resetPassword.and.rejectWith(new Error('Invalid or expired token'));
      const controller = new ResetPasswordController(setFieldErrors, setSubmitError, setResetDone, client);

      await controller.handleSubmit(token, validFields);

      expect(setResetDone).not.toHaveBeenCalled();
    });
  });
});
