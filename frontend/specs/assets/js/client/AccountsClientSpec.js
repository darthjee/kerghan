import AccountsClient from '../../../../assets/js/client/AccountsClient.js';
import ApiClient from '../../../../assets/js/client/ApiClient.js';

describe('AccountsClient', () => {
  const sessionRows = [
    {
      name: '.register',
      call: () => AccountsClient.register({
        username: 'foo', email: 'foo@example.com', password: 'secret', passwordConfirmation: 'secret',
      }),
      endpoint: '/auth/register.json',
      payload: {
        username: 'foo',
        email: 'foo@example.com',
        password: 'secret',
        password_confirmation: 'secret',
      },
    },
    {
      name: '.login',
      call: () => AccountsClient.login({ username: 'foo', password: 'secret' }),
      endpoint: '/auth/login.json',
      payload: { username: 'foo', password: 'secret', keepSignedIn: false },
    },
    {
      name: '.login with keepSignedIn',
      call: () => AccountsClient.login({ username: 'foo', password: 'secret', keepSignedIn: true }),
      endpoint: '/auth/login.json',
      payload: { username: 'foo', password: 'secret', keepSignedIn: true },
    },
    {
      name: '.refresh',
      call: () => AccountsClient.refresh(),
      endpoint: '/auth/refresh.json',
      payload: {},
    },
  ];

  sessionRows.forEach(({
    name, call, endpoint, payload,
  }) => {
    describe(name, () => {
      let result;

      beforeEach(() => {
        result = { user: { id: 1, username: 'foo', email: 'foo@example.com' } };
        spyOn(ApiClient, 'postJson').and.resolveTo(result);
      });

      it(`posts the mapped payload, without any refreshToken, to ${endpoint}`, async () => {
        await call();

        expect(ApiClient.postJson).toHaveBeenCalledWith(endpoint, payload);
      });

      it('resolves with the response', async () => {
        const response = await call();

        expect(response).toEqual(result);
      });
    });
  });

  describe('.migrateLegacyToken', () => {
    it('posts the legacy token in the body to the refresh endpoint through the raw path', async () => {
      spyOn(ApiClient, 'postJson');
      spyOn(ApiClient, 'postJsonOnce').and.resolveTo({ user: { id: 1 } });

      await AccountsClient.migrateLegacyToken('legacy-token');

      expect(ApiClient.postJsonOnce).toHaveBeenCalledWith('/auth/refresh.json', {
        refreshToken: 'legacy-token',
      });
      expect(ApiClient.postJson).not.toHaveBeenCalled();
    });

    it('resolves true when the backend accepts the token', async () => {
      spyOn(ApiClient, 'postJsonOnce').and.resolveTo({ user: { id: 1 } });

      expect(await AccountsClient.migrateLegacyToken('legacy-token')).toBe(true);
    });

    it('swallows a failure and resolves false', async () => {
      spyOn(ApiClient, 'postJsonOnce').and.rejectWith(new Error('Unauthorized'));

      expect(await AccountsClient.migrateLegacyToken('legacy-token')).toBe(false);
    });
  });

  describe('.logout', () => {
    it('sends an empty body to the logoff endpoint', async () => {
      spyOn(ApiClient, 'deleteJson').and.resolveTo();

      await AccountsClient.logout();

      expect(ApiClient.deleteJson).toHaveBeenCalledWith('/auth/logoff.json', {});
    });

    it('propagates a failure', async () => {
      spyOn(ApiClient, 'deleteJson').and.rejectWith(new Error('network error'));

      await expectAsync(AccountsClient.logout()).toBeRejected();
    });
  });

  describe('.status', () => {
    it('posts an empty body to the status endpoint', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ loggedIn: true, isAdmin: false });

      await AccountsClient.status();

      expect(ApiClient.postJson).toHaveBeenCalledWith('/auth/status.json', {});
    });

    it('resolves with the parsed loggedIn/isAdmin response', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ loggedIn: false, isAdmin: false });

      const response = await AccountsClient.status();

      expect(response).toEqual({ loggedIn: false, isAdmin: false });
    });
  });

  describe('.recover', () => {
    it('posts the email to the recover endpoint and resolves with the parsed response', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ sent: true });

      const response = await AccountsClient.recover('foo@example.com');

      expect(ApiClient.postJson).toHaveBeenCalledWith('/auth/recover.json', {
        email: 'foo@example.com',
      });
      expect(response).toEqual({ sent: true });
    });
  });

  describe('.resetPassword', () => {
    it('posts the token and password fields to the reset-password endpoint, mapping to snake_case', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ reset: true });

      await AccountsClient.resetPassword({
        token: 'reset-token', password: 'secret', passwordConfirmation: 'secret',
      });

      expect(ApiClient.postJson).toHaveBeenCalledWith('/auth/reset-password.json', {
        token: 'reset-token',
        password: 'secret',
        password_confirmation: 'secret',
      });
    });

    it('resolves with the parsed response', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ reset: true });

      const response = await AccountsClient.resetPassword({
        token: 'reset-token', password: 'secret', passwordConfirmation: 'secret',
      });

      expect(response).toEqual({ reset: true });
    });
  });

  describe('.updateAccount', () => {
    it('patches the current password and every filled-in field to the account endpoint', async () => {
      spyOn(ApiClient, 'patchJson').and.resolveTo({ username: 'newname', email: 'foo@example.com' });

      await AccountsClient.updateAccount({
        currentPassword: 'secret', username: 'newname', email: 'foo@example.com', newPassword: 'longenough',
      });

      expect(ApiClient.patchJson).toHaveBeenCalledWith('/auth/account.json', {
        currentPassword: 'secret',
        username: 'newname',
        email: 'foo@example.com',
        newPassword: 'longenough',
      });
    });

    it('omits username, email, and newPassword when not provided', async () => {
      spyOn(ApiClient, 'patchJson').and.resolveTo({ username: 'foo', email: 'foo@example.com' });

      await AccountsClient.updateAccount({ currentPassword: 'secret' });

      expect(ApiClient.patchJson).toHaveBeenCalledWith('/auth/account.json', {
        currentPassword: 'secret',
      });
    });

    it('never sends a refreshToken', async () => {
      spyOn(ApiClient, 'patchJson').and.resolveTo({ username: 'foo', email: 'foo@example.com' });

      await AccountsClient.updateAccount({ currentPassword: 'secret', newPassword: 'longenough' });

      const [, body] = ApiClient.patchJson.calls.mostRecent().args;

      expect(Object.keys(body)).not.toContain('refreshToken');
    });

    it('resolves with the updated username and email', async () => {
      const result = { username: 'newname', email: 'foo@example.com' };
      spyOn(ApiClient, 'patchJson').and.resolveTo(result);

      const response = await AccountsClient.updateAccount({ currentPassword: 'secret', username: 'newname' });

      expect(response).toEqual(result);
    });

    it('propagates an ApiError from a wrong current password or duplicate field', async () => {
      const error = new Error('Invalid current password');
      error.status = 400;
      spyOn(ApiClient, 'patchJson').and.rejectWith(error);

      await expectAsync(
        AccountsClient.updateAccount({ currentPassword: 'wrong', username: 'newname' }),
      ).toBeRejectedWith(error);
    });
  });
});
