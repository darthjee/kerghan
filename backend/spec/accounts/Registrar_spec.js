import bcrypt from 'bcryptjs';
import { UniqueConstraintError, ValidationError, ValidationErrorItem } from 'sequelize';
import { Registrar } from '../../lib/accounts/Registrar.js';
import { BadRequestError } from '../../lib/exceptions/http/BadRequestError.js';

describe('Registrar', () => {
  let userModel;
  let registrar;

  beforeEach(() => {
    userModel = jasmine.createSpyObj('User', ['create']);
    registrar = new Registrar(userModel);
  });

  describe('when the account is created successfully', () => {
    const createdUser = { id: 1, username: 'darthjee', email: 'darthjee@example.com' };

    beforeEach(() => {
      userModel.create.and.resolveTo(createdUser);
    });

    it('resolves with the created user', async () => {
      const result = await registrar.register({
        username: 'darthjee',
        email: 'darthjee@example.com',
        password: 'my-password',
      });

      expect(result).toBe(createdUser);
    });

    it('creates the user with a hashed password digest', async () => {
      await registrar.register({
        username: 'darthjee',
        email: 'darthjee@example.com',
        password: 'my-password',
      });

      const { passwordDigest } = userModel.create.calls.mostRecent().args[0];

      expect(passwordDigest).not.toBe('my-password');
      await expectAsync(bcrypt.compare('my-password', passwordDigest)).toBeResolvedTo(true);
    });

    it('creates the user with the given username and email', async () => {
      await registrar.register({
        username: 'darthjee',
        email: 'darthjee@example.com',
        password: 'my-password',
      });

      expect(userModel.create).toHaveBeenCalledWith(jasmine.objectContaining({
        username: 'darthjee',
        email: 'darthjee@example.com',
      }));
    });
  });

  describe('when the username is already taken', () => {
    beforeEach(() => {
      const error = new UniqueConstraintError({
        errors: [new ValidationErrorItem('username must be unique', 'unique violation', 'username', 'darthjee')],
      });
      userModel.create.and.rejectWith(error);
    });

    it('rejects with BadRequestError', async () => {
      await expectAsync(
        registrar.register({ username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' })
      ).toBeRejectedWithError(BadRequestError, 'username is not available');
    });
  });

  describe('when the email is already taken', () => {
    beforeEach(() => {
      const error = new UniqueConstraintError({
        errors: [new ValidationErrorItem('email must be unique', 'unique violation', 'email', 'darthjee@example.com')],
      });
      userModel.create.and.rejectWith(error);
    });

    it('rejects with BadRequestError', async () => {
      await expectAsync(
        registrar.register({ username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' })
      ).toBeRejectedWithError(BadRequestError, 'email is not available');
    });
  });

  describe('when the email is malformed', () => {
    beforeEach(() => {
      const error = new ValidationError('Validation error: Validation isEmail on email failed', [
        new ValidationErrorItem('Validation isEmail on email failed', 'validation error', 'email', 'not-an-email'),
      ]);
      userModel.create.and.rejectWith(error);
    });

    it('rejects with BadRequestError relaying the validation message', async () => {
      await expectAsync(
        registrar.register({ username: 'darthjee', email: 'not-an-email', password: 'my-password' })
      ).toBeRejectedWithError(BadRequestError, 'Validation isEmail on email failed');
    });
  });

  describe('when an unrecognized error is raised', () => {
    const error = new Error('connection lost');

    beforeEach(() => {
      userModel.create.and.rejectWith(error);
    });

    it('rethrows the error unchanged', async () => {
      await expectAsync(
        registrar.register({ username: 'darthjee', email: 'darthjee@example.com', password: 'my-password' })
      ).toBeRejectedWith(error);
    });
  });
});
