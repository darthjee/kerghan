import ApiClient from '../../../../assets/js/client/ApiClient.js';
import ApiError from '../../../../assets/js/client/ApiError.js';
import IntegrationsClient from '../../../../assets/js/client/IntegrationsClient.js';

describe('IntegrationsClient', () => {
  const integration = { id: 'abc-123', label: 'Work', type: 'pat' };
  const credential = { token: 'ghp_canary' };

  describe('.listMine', () => {
    it('posts to the mine endpoint and resolves the response', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ integrations: [integration] });

      const response = await IntegrationsClient.listMine();

      expect(ApiClient.postJson).toHaveBeenCalledWith('/integrations/mine.json', {});
      expect(response).toEqual({ integrations: [integration] });
    });

    it('resolves undefined when the session expired', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo(undefined);

      expect(await IntegrationsClient.listMine()).toBeUndefined();
    });
  });

  describe('.listTypes', () => {
    it('posts to the types endpoint and resolves the response', async () => {
      const types = [{ type: 'pat', flows: { credentialPaste: true, redirect: false } }];
      spyOn(ApiClient, 'postJson').and.resolveTo({ types });

      const response = await IntegrationsClient.listTypes();

      expect(ApiClient.postJson).toHaveBeenCalledWith('/integrations/types.json', {});
      expect(response).toEqual({ types });
    });
  });

  describe('.create', () => {
    it('posts the envelope with the github provider', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo(integration);

      const response = await IntegrationsClient.create({ label: 'Work', type: 'pat', credential });

      expect(ApiClient.postJson).toHaveBeenCalledWith('/integrations.json', {
        label: 'Work', provider: 'github', type: 'pat', credential,
      });
      expect(response).toEqual(integration);
    });
  });

  describe('.rename', () => {
    it('patches the label on the integration path', async () => {
      spyOn(ApiClient, 'patchJson').and.resolveTo(integration);

      const response = await IntegrationsClient.rename('abc-123', 'Home');

      expect(ApiClient.patchJson).toHaveBeenCalledWith('/integrations/abc-123.json', { label: 'Home' });
      expect(response).toEqual(integration);
    });

    it('encodes the uuid in the path', async () => {
      spyOn(ApiClient, 'patchJson').and.resolveTo(integration);

      await IntegrationsClient.rename('a/b?c', 'Home');

      expect(ApiClient.patchJson).toHaveBeenCalledWith('/integrations/a%2Fb%3Fc.json', { label: 'Home' });
    });
  });

  describe('.replaceCredential', () => {
    it('posts the credential to the credential path', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo(integration);

      const response = await IntegrationsClient.replaceCredential('abc-123', credential);

      expect(ApiClient.postJson).toHaveBeenCalledWith('/integrations/abc-123/credential.json', { credential });
      expect(response).toEqual(integration);
    });
  });

  describe('.test', () => {
    it('posts to the test path', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo(integration);

      const response = await IntegrationsClient.test('abc-123');

      expect(ApiClient.postJson).toHaveBeenCalledWith('/integrations/abc-123/test.json', {});
      expect(response).toEqual(integration);
    });

    it('propagates an ApiError carrying the retry-after seconds', async () => {
      const error = new ApiError(429, 'Too soon', 'INTEGRATION_TEST_COOLDOWN', undefined, 30);
      spyOn(ApiClient, 'postJson').and.rejectWith(error);

      await expectAsync(IntegrationsClient.test('abc-123')).toBeRejectedWith(error);
    });
  });

  describe('.remove', () => {
    it('deletes the integration path', async () => {
      spyOn(ApiClient, 'deleteJson').and.resolveTo({});

      const response = await IntegrationsClient.remove('abc-123');

      expect(ApiClient.deleteJson).toHaveBeenCalledWith('/integrations/abc-123.json', {});
      expect(response).toEqual({});
    });
  });

  describe('.startOauthApp', () => {
    const authorizeUrl = 'https://github.com/login/oauth/authorize?client_id=x';

    it('posts the label to start a create', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ authorizeUrl });

      const response = await IntegrationsClient.startOauthApp({ label: 'Work' });

      expect(ApiClient.postJson).toHaveBeenCalledWith('/integrations/oauth_app/start.json', { label: 'Work' });
      expect(response).toEqual({ authorizeUrl });
    });

    it('posts the integrationId to start a reconnect', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ authorizeUrl });

      await IntegrationsClient.startOauthApp({ integrationId: 'abc-123' });

      expect(ApiClient.postJson).toHaveBeenCalledWith(
        '/integrations/oauth_app/start.json', { integrationId: 'abc-123' },
      );
    });

    it('resolves undefined when the session expired', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo(undefined);

      expect(await IntegrationsClient.startOauthApp({ label: 'Work' })).toBeUndefined();
    });
  });

  describe('.completeOauthApp', () => {
    it('posts the code and state to the callback path', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo(integration);

      const response = await IntegrationsClient.completeOauthApp({ code: 'code_canary', state: 'state_canary' });

      expect(ApiClient.postJson).toHaveBeenCalledWith(
        '/integrations/oauth_app/callback.json', { code: 'code_canary', state: 'state_canary' },
      );
      expect(response).toEqual(integration);
    });

    it('resolves undefined when the session expired', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo(undefined);

      expect(await IntegrationsClient.completeOauthApp({ code: 'c', state: 's' })).toBeUndefined();
    });
  });

  describe('error propagation', () => {
    const error = new ApiError(404, 'Not found', 'NOT_FOUND');

    it('propagates ApiError from create', async () => {
      spyOn(ApiClient, 'postJson').and.rejectWith(error);

      await expectAsync(IntegrationsClient.create({ label: 'Work', type: 'pat', credential }))
        .toBeRejectedWith(error);
    });

    it('propagates ApiError from rename', async () => {
      spyOn(ApiClient, 'patchJson').and.rejectWith(error);

      await expectAsync(IntegrationsClient.rename('abc-123', 'Home')).toBeRejectedWith(error);
    });

    it('propagates ApiError from replaceCredential', async () => {
      spyOn(ApiClient, 'postJson').and.rejectWith(error);

      await expectAsync(IntegrationsClient.replaceCredential('abc-123', credential)).toBeRejectedWith(error);
    });

    it('propagates ApiError from remove', async () => {
      spyOn(ApiClient, 'deleteJson').and.rejectWith(error);

      await expectAsync(IntegrationsClient.remove('abc-123')).toBeRejectedWith(error);
    });

    it('propagates ApiError from startOauthApp', async () => {
      spyOn(ApiClient, 'postJson').and.rejectWith(error);

      await expectAsync(IntegrationsClient.startOauthApp({ label: 'Work' })).toBeRejectedWith(error);
    });

    it('propagates ApiError from completeOauthApp', async () => {
      spyOn(ApiClient, 'postJson').and.rejectWith(error);

      await expectAsync(IntegrationsClient.completeOauthApp({ code: 'c', state: 's' })).toBeRejectedWith(error);
    });

    it('propagates ApiError from listMine', async () => {
      spyOn(ApiClient, 'postJson').and.rejectWith(error);

      await expectAsync(IntegrationsClient.listMine()).toBeRejectedWith(error);
    });
  });
});
