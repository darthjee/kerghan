import bcrypt from 'bcryptjs';
import { Authenticator } from '../../lib/accounts/Authenticator.js';
import { UnauthorizedError } from '../../lib/exceptions/http/UnauthorizedError.js';

describe('Authenticator', () => {
  let userModel;
  let authenticator;
  let user;

  beforeEach(async () => {
    user = {
      id: 1,
      username: 'darthjee',
      passwordDigest: await bcrypt.hash('correct-password', 4),
    };
    userModel = jasmine.createSpyObj('User', ['findOne']);
    authenticator = new Authenticator(userModel);
  });

  describe('when the username exists and the password matches', () => {
    beforeEach(() => {
      userModel.findOne.and.resolveTo(user);
    });

    it('resolves with the user', async () => {
      const result = await authenticator.authenticate({
        username: 'darthjee',
        password: 'correct-password',
      });

      expect(result).toBe(user);
    });

    it('looks the user up by username', async () => {
      await authenticator.authenticate({ username: 'darthjee', password: 'correct-password' });

      expect(userModel.findOne).toHaveBeenCalledWith({ where: { username: 'darthjee' } });
    });
  });

  describe('when the password is wrong', () => {
    beforeEach(() => {
      userModel.findOne.and.resolveTo(user);
    });

    it('rejects with UnauthorizedError', async () => {
      await expectAsync(
        authenticator.authenticate({ username: 'darthjee', password: 'wrong-password' })
      ).toBeRejectedWithError(UnauthorizedError, 'Invalid username or password');
    });
  });

  describe('when the username is unknown', () => {
    beforeEach(() => {
      userModel.findOne.and.resolveTo(null);
    });

    it('rejects with UnauthorizedError', async () => {
      await expectAsync(
        authenticator.authenticate({ username: 'nobody', password: 'whatever' })
      ).toBeRejectedWithError(UnauthorizedError, 'Invalid username or password');
    });
  });
});
