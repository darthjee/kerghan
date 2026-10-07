import AccountsClient from '../../../../assets/js/client/AccountsClient.js';
import ApiClient from '../../../../assets/js/client/ApiClient.js';
import AuthSession from '../../../../assets/js/client/AuthSession.js';

describe('AccountsClient sessions', () => {
  afterEach(() => {
    AuthSession.clear();
  });

  const cases = [
    {
      name: '.listSessions',
      call: () => AccountsClient.listSessions(),
      url: '/auth/sessions/mine.json',
      result: {
        sessions: [{
          id: 'session-uuid',
          startedAt: '2026-10-01T00:00:00.000Z',
          lastUsedAt: '2026-10-02T00:00:00.000Z',
          keepSignedIn: false,
          current: true,
        }],
      },
    },
    {
      name: '.revokeSession',
      call: () => AccountsClient.revokeSession('session-uuid'),
      url: '/auth/sessions/session-uuid/revoke.json',
      result: { revoked: true },
    },
    {
      name: '.revokeOtherSessions',
      call: () => AccountsClient.revokeOtherSessions(),
      url: '/auth/sessions/revoke-others.json',
      result: { revoked: true },
    },
  ];

  cases.forEach(({ name, call, url, result }) => {
    describe(name, () => {
      it('posts the stored refresh token and resolves with the result', async () => {
        AuthSession.set('refresh-token');
        spyOn(ApiClient, 'postJson').and.resolveTo(result);

        const response = await call();

        expect(ApiClient.postJson).toHaveBeenCalledWith(url, { refreshToken: 'refresh-token' });
        expect(response).toEqual(result);
      });

      it('posts an undefined refresh token when none is stored', async () => {
        spyOn(ApiClient, 'postJson').and.resolveTo(result);

        await call();

        expect(ApiClient.postJson).toHaveBeenCalledWith(url, { refreshToken: undefined });
      });

      it('does not touch the stored refresh token', async () => {
        AuthSession.set('refresh-token');
        spyOn(ApiClient, 'postJson').and.resolveTo(result);

        await call();

        expect(AuthSession.get()).toBe('refresh-token');
      });

      it('resolves undefined when the session expired', async () => {
        spyOn(ApiClient, 'postJson').and.resolveTo(undefined);

        expect(await call()).toBeUndefined();
      });

      it('propagates an ApiError', async () => {
        const error = new Error('not found');
        error.status = 404;
        spyOn(ApiClient, 'postJson').and.rejectWith(error);

        await expectAsync(call()).toBeRejectedWith(error);
      });
    });
  });
});
