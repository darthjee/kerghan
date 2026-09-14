import AdminUserEditController from '../../../../../../../../assets/js/components/resources/admin/pages/controllers/AdminUserEditController.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';

describe('AdminUserEditController', () => {
  let setFields;
  let setFieldErrors;
  let setSubmitError;
  let setSuccess;
  let client;

  const blankFields = {
    username: '',
    email: '',
    newPassword: '',
    newPasswordConfirmation: '',
  };

  beforeEach(() => {
    setFields = jasmine.createSpy('setFields');
    setFieldErrors = jasmine.createSpy('setFieldErrors');
    setSubmitError = jasmine.createSpy('setSubmitError');
    setSuccess = jasmine.createSpy('setSuccess');
    client = jasmine.createSpyObj('client', ['editUser']);
  });

  const buildController = () => new AdminUserEditController(
    setFields, setFieldErrors, setSubmitError, setSuccess, client,
  );

  describe('#validate', () => {
    it('returns no errors for a blank form', () => {
      const controller = buildController();

      expect(controller.validate(blankFields)).toEqual({});
    });

    it('flags a malformed email', () => {
      const controller = buildController();

      expect(
        controller.validate({ ...blankFields, email: 'not-an-email' }).email,
      ).toBeDefined();
    });

    it('accepts a blank email', () => {
      const controller = buildController();

      expect(controller.validate({ ...blankFields, email: '' }).email).toBeUndefined();
    });

    it('accepts a well-formed email', () => {
      const controller = buildController();

      expect(
        controller.validate({ ...blankFields, email: 'foo@example.com' }).email,
      ).toBeUndefined();
    });

    it('flags a new password shorter than 8 characters', () => {
      const controller = buildController();

      expect(
        controller.validate({
          ...blankFields, newPassword: 'short', newPasswordConfirmation: 'short',
        }).newPassword,
      ).toBeDefined();
    });

    it('flags a new password/confirmation mismatch', () => {
      const controller = buildController();

      expect(
        controller.validate({
          ...blankFields, newPassword: 'longenough', newPasswordConfirmation: 'other',
        }).newPasswordConfirmation,
      ).toBeDefined();
    });

    it('accepts a matching, long-enough new password and confirmation', () => {
      const controller = buildController();

      expect(controller.validate({
        ...blankFields, newPassword: 'longenough', newPasswordConfirmation: 'longenough',
      })).toEqual({});
    });
  });

  describe('#handleSubmit', () => {
    it('sets field errors and skips the API call when the form is invalid', async () => {
      const controller = buildController();

      await controller.handleSubmit(1, { ...blankFields, email: 'not-an-email' });

      expect(setFieldErrors).toHaveBeenCalledWith(
        jasmine.objectContaining({ email: jasmine.any(String) }),
      );
      expect(client.editUser).not.toHaveBeenCalled();
    });

    it('sets a submit error and skips the API call when no field was actually filled in', async () => {
      const controller = buildController();

      await controller.handleSubmit(1, blankFields);

      expect(setFieldErrors).toHaveBeenCalledWith({});
      expect(setSubmitError).toHaveBeenCalledWith(jasmine.any(String));
      expect(client.editUser).not.toHaveBeenCalled();
    });

    it('submits only the username when just the username changed', async () => {
      client.editUser.and.resolveTo({ user: { username: 'newname', email: 'foo@example.com' } });
      const controller = buildController();

      await controller.handleSubmit(1, { ...blankFields, username: 'newname' });

      expect(client.editUser).toHaveBeenCalledWith(1, { username: 'newname' });
    });

    it('submits only the email when just the email changed', async () => {
      client.editUser.and.resolveTo({ user: { username: 'foo', email: 'new@example.com' } });
      const controller = buildController();

      await controller.handleSubmit(1, { ...blankFields, email: 'new@example.com' });

      expect(client.editUser).toHaveBeenCalledWith(1, { email: 'new@example.com' });
    });

    it('submits only the new password when just the password changed', async () => {
      client.editUser.and.resolveTo({ user: { username: 'foo', email: 'foo@example.com' } });
      const controller = buildController();

      await controller.handleSubmit(1, {
        ...blankFields, newPassword: 'longenough', newPasswordConfirmation: 'longenough',
      });

      expect(client.editUser).toHaveBeenCalledWith(1, { newPassword: 'longenough' });
    });

    it('submits every changed field together', async () => {
      client.editUser.and.resolveTo({ user: { username: 'newname', email: 'new@example.com' } });
      const controller = buildController();

      await controller.handleSubmit(1, {
        username: 'newname',
        email: 'new@example.com',
        newPassword: 'longenough',
        newPasswordConfirmation: 'longenough',
      });

      expect(client.editUser).toHaveBeenCalledWith(1, {
        username: 'newname',
        email: 'new@example.com',
        newPassword: 'longenough',
      });
    });

    it('reflects the response user\'s username/email, clears the password fields, and flags success', async () => {
      client.editUser.and.resolveTo({ user: { username: 'newname', email: 'foo@example.com' } });
      const controller = buildController();

      await controller.handleSubmit(1, { ...blankFields, username: 'newname' });

      const updater = setFields.calls.mostRecent().args[0];
      expect(updater({ username: 'old', email: 'foo@example.com' }))
        .toEqual({
          username: 'newname',
          email: 'foo@example.com',
          newPassword: '',
          newPasswordConfirmation: '',
        });
      expect(setSuccess).toHaveBeenCalledWith(true);
    });

    it('stores the submit error on a duplicate username', async () => {
      client.editUser.and.rejectWith(new ApiError(400, 'Username already in use'));
      const controller = buildController();

      await controller.handleSubmit(1, { ...blankFields, username: 'taken' });

      expect(setSubmitError).toHaveBeenCalledWith('Username already in use');
    });

    it('stores the submit error on a duplicate email', async () => {
      client.editUser.and.rejectWith(new ApiError(400, 'Email already in use'));
      const controller = buildController();

      await controller.handleSubmit(1, { ...blankFields, email: 'taken@example.com' });

      expect(setSubmitError).toHaveBeenCalledWith('Email already in use');
    });

    it('stores the submit error on a password too short', async () => {
      client.editUser.and.rejectWith(new ApiError(400, 'Password too short'));
      const controller = buildController();

      await controller.handleSubmit(1, {
        ...blankFields, newPassword: 'longenough', newPasswordConfirmation: 'longenough',
      });

      expect(setSubmitError).toHaveBeenCalledWith('Password too short');
    });

    it('does nothing further when the session turned out to be expired', async () => {
      client.editUser.and.resolveTo(undefined);
      const controller = buildController();

      await controller.handleSubmit(1, { ...blankFields, username: 'newname' });

      expect(setFields).not.toHaveBeenCalled();
      expect(setSuccess).not.toHaveBeenCalledWith(true);
    });

    it('redirects home without setting a submit error on a 403', async () => {
      client.editUser.and.rejectWith(new ApiError(403, 'Forbidden'));
      const controller = buildController();
      const fakeWindow = { location: { hash: '' } };

      globalThis.window = fakeWindow;

      try {
        await controller.handleSubmit(1, { ...blankFields, username: 'newname' });

        expect(fakeWindow.location.hash).toBe('/');
        expect(setSubmitError).not.toHaveBeenCalledWith('Forbidden');
      } finally {
        delete globalThis.window;
      }
    });
  });
});
