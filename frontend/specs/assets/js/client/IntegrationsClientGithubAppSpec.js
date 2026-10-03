import ApiClient from '../../../../assets/js/client/ApiClient.js';
import ApiError from '../../../../assets/js/client/ApiError.js';
import IntegrationsClient from '../../../../assets/js/client/IntegrationsClient.js';

describe('IntegrationsClient (github_app)', () => {
  const integration = { id: 'abc-123', label: 'Work', type: 'github_app' };
  const error = new ApiError(404, 'Not found', 'NOT_FOUND');

  describe('.startGithubApp', () => {
    const redirectUrl = 'https://github.com/apps/kerghan/installations/new?state=x';

    it('posts the label and mode to start a create', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ redirectUrl });

      const response = await IntegrationsClient.startGithubApp({ label: 'Work', mode: 'install' });

      expect(ApiClient.postJson).toHaveBeenCalledWith(
        '/integrations/github_app/start.json', { label: 'Work', mode: 'install' },
      );
      expect(response).toEqual({ redirectUrl });
    });

    it('posts the integrationId and mode to start a reconnect', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ redirectUrl });

      await IntegrationsClient.startGithubApp({ integrationId: 'abc-123', mode: 'connect' });

      expect(ApiClient.postJson).toHaveBeenCalledWith(
        '/integrations/github_app/start.json', { integrationId: 'abc-123', mode: 'connect' },
      );
    });

    it('omits fields that were not provided', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo({ redirectUrl });

      await IntegrationsClient.startGithubApp({ label: 'Work' });

      expect(ApiClient.postJson).toHaveBeenCalledWith(
        '/integrations/github_app/start.json', { label: 'Work' },
      );
    });

    it('resolves undefined when the session expired', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo(undefined);

      expect(await IntegrationsClient.startGithubApp({ label: 'Work' })).toBeUndefined();
    });

    it('propagates an ApiError', async () => {
      spyOn(ApiClient, 'postJson').and.rejectWith(error);

      await expectAsync(IntegrationsClient.startGithubApp({ label: 'Work' })).toBeRejectedWith(error);
    });
  });

  describe('.completeGithubApp', () => {
    it('posts the code, state, installationId and setupAction to the callback path', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo(integration);

      const response = await IntegrationsClient.completeGithubApp({
        code: 'code_canary', state: 'state_canary', installationId: 42, setupAction: 'install',
      });

      expect(ApiClient.postJson).toHaveBeenCalledWith('/integrations/github_app/callback.json', {
        code: 'code_canary', state: 'state_canary', installationId: 42, setupAction: 'install',
      });
      expect(response).toEqual(integration);
    });

    it('omits installationId and setupAction when absent (connect mode)', async () => {
      const selection = { selection: { state: 's2', installations: [] } };
      spyOn(ApiClient, 'postJson').and.resolveTo(selection);

      const response = await IntegrationsClient.completeGithubApp({ code: 'c', state: 's' });

      expect(ApiClient.postJson).toHaveBeenCalledWith(
        '/integrations/github_app/callback.json', { code: 'c', state: 's' },
      );
      expect(response).toEqual(selection);
    });

    it('propagates an ApiError', async () => {
      spyOn(ApiClient, 'postJson').and.rejectWith(error);

      await expectAsync(IntegrationsClient.completeGithubApp({ code: 'c', state: 's' }))
        .toBeRejectedWith(error);
    });
  });

  describe('.selectGithubAppInstallation', () => {
    it('posts the state and installationId to the select path', async () => {
      spyOn(ApiClient, 'postJson').and.resolveTo(integration);

      const response = await IntegrationsClient.selectGithubAppInstallation({
        state: 'state_canary', installationId: 7,
      });

      expect(ApiClient.postJson).toHaveBeenCalledWith(
        '/integrations/github_app/select.json', { state: 'state_canary', installationId: 7 },
      );
      expect(response).toEqual(integration);
    });

    it('propagates an ApiError', async () => {
      spyOn(ApiClient, 'postJson').and.rejectWith(error);

      await expectAsync(IntegrationsClient.selectGithubAppInstallation({ state: 's', installationId: 7 }))
        .toBeRejectedWith(error);
    });
  });
});
