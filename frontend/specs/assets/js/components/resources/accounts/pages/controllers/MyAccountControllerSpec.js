import MyAccountController from '../../../../../../../../assets/js/components/resources/accounts/pages/controllers/MyAccountController.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';

describe('MyAccountController', () => {
  let setFields;
  let setFieldErrors;
  let setSubmitError;
  let setSuccess;
  let client;

  const blankFields = {
    username: '',
    email: '',
    currentPassword: 'secret',
    newPassword: '',
    newPasswordConfirmation: '',
  };

  beforeEach(() => {
    setFields = jasmine.createSpy('setFields');
    setFieldErrors = jasmine.createSpy('setFieldErrors');
    setSubmitError = jasmine.createSpy('setSubmitError');
    setSuccess = jasmine.createSpy('setSuccess');
    client = jasmine.createSpyObj('client', ['updateAccount']);
  });

  const buildController = () => new MyAccountController(
    setFields, setFieldErrors, setSubmitError, setSuccess, client,
  );

  describe('#validate', () => {
    it('returns no errors for a form with only the current password filled in', () => {
      const controller = buildController();

      expect(controller.validate(blankFields)).toEqual({});
    });

    it('flags a missing current password', () => {
      const controller = buildController();

      expect(
        controller.validate({ ...blankFields, currentPassword: '' }).currentPassword,
      ).toBeDefined();
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

      await controller.handleSubmit({ ...blankFields, currentPassword: '' });

      expect(setFieldErrors).toHaveBeenCalledWith(
        jasmine.objectContaining({ currentPassword: jasmine.any(String) }),
      );
      expect(client.updateAccount).not.toHaveBeenCalled();
    });

    it('sets a submit error and skips the API call when no field was actually filled in', async () => {
      const controller = buildController();

      await controller.handleSubmit(blankFields);

      expect(setFieldErrors).toHaveBeenCalledWith({});
      expect(setSubmitError).toHaveBeenCalledWith(jasmine.any(String));
      expect(client.updateAccount).not.toHaveBeenCalled();
    });

    it('submits only the current password and username when just the username changed', async () => {
      client.updateAccount.and.resolveTo({ username: 'newname', email: 'foo@example.com' });
      const controller = buildController();

      await controller.handleSubmit({ ...blankFields, username: 'newname' });

      expect(client.updateAccount).toHaveBeenCalledWith({
        currentPassword: 'secret', username: 'newname',
      });
    });

    it('submits only the current password and email when just the email changed', async () => {
      client.updateAccount.and.resolveTo({ username: 'foo', email: 'new@example.com' });
      const controller = buildController();

      await controller.handleSubmit({ ...blankFields, email: 'new@example.com' });

      expect(client.updateAccount).toHaveBeenCalledWith({
        currentPassword: 'secret', email: 'new@example.com',
      });
    });

    it('submits only the current password and new password when just the password changed', async () => {
      client.updateAccount.and.resolveTo({ username: 'foo', email: 'foo@example.com' });
      const controller = buildController();

      await controller.handleSubmit({
        ...blankFields, newPassword: 'longenough', newPasswordConfirmation: 'longenough',
      });

      expect(client.updateAccount).toHaveBeenCalledWith({
        currentPassword: 'secret', newPassword: 'longenough',
      });
    });

    it('submits every changed field together', async () => {
      client.updateAccount.and.resolveTo({ username: 'newname', email: 'new@example.com' });
      const controller = buildController();

      await controller.handleSubmit({
        username: 'newname',
        email: 'new@example.com',
        currentPassword: 'secret',
        newPassword: 'longenough',
        newPasswordConfirmation: 'longenough',
      });

      expect(client.updateAccount).toHaveBeenCalledWith({
        currentPassword: 'secret',
        username: 'newname',
        email: 'new@example.com',
        newPassword: 'longenough',
      });
    });

    it('reflects the response username/email, clears the password fields, and flags success', async () => {
      client.updateAccount.and.resolveTo({ username: 'newname', email: 'foo@example.com' });
      const controller = buildController();

      await controller.handleSubmit({ ...blankFields, username: 'newname' });

      const updater = setFields.calls.mostRecent().args[0];
      expect(updater({ username: 'old', email: 'foo@example.com', currentPassword: 'secret' }))
        .toEqual({
          username: 'newname',
          email: 'foo@example.com',
          currentPassword: '',
          newPassword: '',
          newPasswordConfirmation: '',
        });
      expect(setSuccess).toHaveBeenCalledWith(true);
    });

    it('stores the submit error and does not update the fields on a wrong current password', async () => {
      client.updateAccount.and.rejectWith(new ApiError(400, 'Invalid current password'));
      const controller = buildController();

      await controller.handleSubmit({ ...blankFields, username: 'newname' });

      expect(setSubmitError).toHaveBeenCalledWith('Invalid current password');
      expect(setFields).not.toHaveBeenCalled();
      expect(setSuccess).not.toHaveBeenCalledWith(true);
    });

    it('stores the submit error on a duplicate username', async () => {
      client.updateAccount.and.rejectWith(new ApiError(400, 'Username already in use'));
      const controller = buildController();

      await controller.handleSubmit({ ...blankFields, username: 'taken' });

      expect(setSubmitError).toHaveBeenCalledWith('Username already in use');
    });

    it('stores the submit error on a duplicate email', async () => {
      client.updateAccount.and.rejectWith(new ApiError(400, 'Email already in use'));
      const controller = buildController();

      await controller.handleSubmit({ ...blankFields, email: 'taken@example.com' });

      expect(setSubmitError).toHaveBeenCalledWith('Email already in use');
    });

    it('does nothing further when the session turned out to be expired', async () => {
      client.updateAccount.and.resolveTo(undefined);
      const controller = buildController();

      await controller.handleSubmit({ ...blankFields, username: 'newname' });

      expect(setFields).not.toHaveBeenCalled();
      expect(setSuccess).not.toHaveBeenCalledWith(true);
    });
  });
});
