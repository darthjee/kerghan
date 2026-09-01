import AccountsClient from '../../../../assets/js/client/AccountsClient.js';
import ApiClient from '../../../../assets/js/client/ApiClient.js';
import AuthSession from '../../../../assets/js/client/AuthSession.js';

describe('AccountsClient', () => {
  afterEach(() => {
    AuthSession.clear();
  });

  describe('.register', () => {
    it('posts registration fields to the register endpoint, mapping to snake_case', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({
        user: { id: 1, username: 'foo', email: 'foo@example.com' },
        refreshToken: 'refresh-token',
      });

      await AccountsClient.register({
        username: 'foo', email: 'foo@example.com', password: 'secret', passwordConfirmation: 'secret',
      });

      expect(ApiClient.postJson).toHaveBeenCalledWith('/auth/register.json', {
        username: 'foo',
        email: 'foo@example.com',
        password: 'secret',
        password_confirmation: 'secret',
      });
    });

    it('resolves with the created account and refresh token', async () => {
      const result = {
        user: { id: 1, username: 'foo', email: 'foo@example.com' },
        refreshToken: 'refresh-token',
      };
      spyOn(ApiClient, 'postJson').and.resolveTo(result);

      const response = await AccountsClient.register({
        username: 'foo', email: 'foo@example.com', password: 'secret', passwordConfirmation: 'secret',
      });

      expect(response).toEqual(result);
    });

    it('persists the returned refresh token', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({
        user: { id: 1, username: 'foo', email: 'foo@example.com' },
        refreshToken: 'refresh-token',
      });

      await AccountsClient.register({
        username: 'foo', email: 'foo@example.com', password: 'secret', passwordConfirmation: 'secret',
      });

      expect(AuthSession.get()).toBe('refresh-token');
    });
  });

  describe('.login', () => {
    it('posts credentials to the login endpoint', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({
        user: { id: 1, username: 'foo', email: 'foo@example.com' },
        refreshToken: 'refresh-token',
      });

      await AccountsClient.login({ username: 'foo', password: 'secret' });

      expect(ApiClient.postJson).toHaveBeenCalledWith('/auth/login.json', {
        username: 'foo',
        password: 'secret',
      });
    });

    it('persists the returned refresh token and resolves with the response', async () => {
      const result = {
        user: { id: 1, username: 'foo', email: 'foo@example.com' },
        refreshToken: 'refresh-token',
      };
      spyOn(ApiClient, 'postJson').and.resolveTo(result);

      const response = await AccountsClient.login({ username: 'foo', password: 'secret' });

      expect(response).toEqual(result);
      expect(AuthSession.get()).toBe('refresh-token');
    });
  });

  describe('.refresh', () => {
    it('posts the current refresh token to the refresh endpoint', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({
        user: { id: 1, username: 'foo', email: 'foo@example.com' },
        refreshToken: 'new-refresh-token',
      });

      await AccountsClient.refresh('old-refresh-token');

      expect(ApiClient.postJson).toHaveBeenCalledWith('/auth/refresh.json', {
        refreshToken: 'old-refresh-token',
      });
    });

    it('persists the renewed refresh token and resolves with the response', async () => {
      const result = {
        user: { id: 1, username: 'foo', email: 'foo@example.com' },
        refreshToken: 'new-refresh-token',
      };
      spyOn(ApiClient, 'postJson').and.resolveTo(result);

      const response = await AccountsClient.refresh('old-refresh-token');

      expect(response).toEqual(result);
      expect(AuthSession.get()).toBe('new-refresh-token');
    });
  });

  describe('.logout', () => {
    it('sends the refresh token to the logoff endpoint', async () => {
      spyOn(ApiClient, 'deleteJson').and.resolveTo();

      await AccountsClient.logout('refresh-token');

      expect(ApiClient.deleteJson).toHaveBeenCalledWith('/auth/logoff.json', {
        refreshToken: 'refresh-token',
      });
    });

    it('clears the stored refresh token on success', async () => {
      AuthSession.set('refresh-token');
      spyOn(ApiClient, 'deleteJson').and.resolveTo();

      await AccountsClient.logout('refresh-token');

      expect(AuthSession.get()).toBeNull();
    });

    it('clears the stored refresh token even when the request fails', async () => {
      AuthSession.set('refresh-token');
      spyOn(ApiClient, 'deleteJson').and.rejectWith(new Error('network error'));

      await expectAsync(AccountsClient.logout('refresh-token')).toBeRejected();

      expect(AuthSession.get()).toBeNull();
    });
  });

  describe('.status', () => {
    it('posts the refresh token to the status endpoint', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ loggedIn: true });

      await AccountsClient.status('refresh-token');

      expect(ApiClient.postJson).toHaveBeenCalledWith('/auth/status.json', {
        refreshToken: 'refresh-token',
      });
    });

    it('resolves with the parsed loggedIn response', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ loggedIn: false });

      const response = await AccountsClient.status('refresh-token');

      expect(response).toEqual({ loggedIn: false });
    });

    it('does not touch the stored refresh token', async () => {
      AuthSession.set('refresh-token');
      spyOn(ApiClient, 'postJson').and.resolveTo({ loggedIn: false });

      await AccountsClient.status('refresh-token');

      expect(AuthSession.get()).toBe('refresh-token');
    });
  });

  describe('.recover', () => {
    it('posts the email to the recover endpoint', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ sent: true });

      await AccountsClient.recover('foo@example.com');

      expect(ApiClient.postJson).toHaveBeenCalledWith('/auth/recover.json', {
        email: 'foo@example.com',
      });
    });

    it('resolves with the parsed response', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ sent: true });

      const response = await AccountsClient.recover('foo@example.com');

      expect(response).toEqual({ sent: true });
    });

    it('does not touch the stored refresh token', async () => {
      AuthSession.set('refresh-token');
      spyOn(ApiClient, 'postJson').and.resolveTo({ sent: true });

      await AccountsClient.recover('foo@example.com');

      expect(AuthSession.get()).toBe('refresh-token');
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

    it('does not touch the stored refresh token', async () => {
      AuthSession.set('refresh-token');
      spyOn(ApiClient, 'postJson').and.resolveTo({ reset: true });

      await AccountsClient.resetPassword({
        token: 'reset-token', password: 'secret', passwordConfirmation: 'secret',
      });

      expect(AuthSession.get()).toBe('refresh-token');
    });
  });
});
