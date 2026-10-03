import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import { CLOSED_ADD_FORM } from '../../../../../../../../assets/js/components/resources/accounts/pages/controllers/IntegrationsController.js';
import GithubAppLanding from '../../../../../../../../assets/js/utils/oauth/GithubAppLanding.js';
import OauthAppLanding from '../../../../../../../../assets/js/utils/oauth/OauthAppLanding.js';
import { buildIntegration, useIntegrationsControllerHarness } from '../../../../../../../support/integrationsControllerHarness.js';

describe('IntegrationsController GitHub App flow', () => {
  const INSTALL_URL = 'https://github.com/apps/kerghan/installations/new?state=s';
  const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize?client_id=Iv1.abc&state=s';
  const CODE = 'CODEcanary0000';
  const STATE = 'STATEcanary0000';
  const context = useIntegrationsControllerHarness();
  let state;
  let client;
  let navigate;
  let history;

  const land = (search) => GithubAppLanding.capture(
    { pathname: '/integrations/github_app/callback', search }, history,
  );

  beforeEach(() => {
    ({ state, client, navigate } = context);
    history = jasmine.createSpyObj('history', ['replaceState']);
    client.listMine.and.resolveTo({ integrations: [] });
    client.listTypes.and.resolveTo({ types: [] });
  });

  afterEach(() => {
    GithubAppLanding.take();
    OauthAppLanding.take();
  });

  describe('#create', () => {
    const form = { type: 'github_app', label: 'Work', credential: {} };

    beforeEach(() => {
      state.addForm = { ...CLOSED_ADD_FORM, open: true, ...form };
    });

    it('starts the install flow with the label and mode', async () => {
      client.startGithubApp.and.resolveTo({ redirectUrl: INSTALL_URL });

      await context.buildController().create(form, 'install');

      expect(client.create).not.toHaveBeenCalled();
      expect(client.startOauthApp).not.toHaveBeenCalled();
      expect(client.startGithubApp).toHaveBeenCalledOnceWith({ label: 'Work', mode: 'install' });
      expect(navigate).toHaveBeenCalledWith(INSTALL_URL);
    });

    it('starts the connect flow', async () => {
      client.startGithubApp.and.resolveTo({ redirectUrl: AUTHORIZE_URL });

      await context.buildController().create(form, 'connect');

      expect(client.startGithubApp).toHaveBeenCalledOnceWith({ label: 'Work', mode: 'connect' });
      expect(navigate).toHaveBeenCalledWith(AUTHORIZE_URL);
    });

    it('does not follow an unexpected redirectUrl', async () => {
      client.startGithubApp.and.resolveTo({ redirectUrl: 'https://github.com/settings?x=1' });

      await context.buildController().create(form, 'install');

      expect(navigate).not.toHaveBeenCalled();
      expect(state.addForm.error).toContain('unexpected authorization address');
    });
  });

  describe('#startRedirect for a reconnect', () => {
    it('starts with the integrationId and mode', async () => {
      client.startGithubApp.and.resolveTo({ redirectUrl: INSTALL_URL });

      await context.buildController().startRedirect('github_app', { integrationId: 'abc', mode: 'install' });

      expect(client.startGithubApp).toHaveBeenCalledOnceWith({ integrationId: 'abc', mode: 'install' });
      expect(navigate).toHaveBeenCalledWith(INSTALL_URL);
    });

    it('maps an API error onto the row', async () => {
      client.startGithubApp.and.rejectWith(new ApiError(423, 'raw', 'INTEGRATION_CREDENTIAL_LOCKED'));

      await context.buildController().startRedirect('github_app', { integrationId: 'abc', mode: 'connect' });

      expect(state.rowState.get('abc').error).toContain('Too many failed attempts');
    });
  });

  describe('#load with a GitHub App landing', () => {
    it('cleans the URL before posting the callback, then loads the list', async () => {
      client.completeGithubApp.and.resolveTo(buildIntegration({ type: 'github_app', githubLogin: 'acme' }));
      land(`?code=${CODE}&installation_id=5&setup_action=install&state=${STATE}`);

      await context.buildController().load();

      expect(history.replaceState).toHaveBeenCalledBefore(client.completeGithubApp);
      expect(client.completeGithubApp).toHaveBeenCalledBefore(client.listMine);
      expect(client.completeOauthApp).not.toHaveBeenCalled();
      expect(state.notice).toEqual({
        variant: 'success', text: 'Connected to the GitHub App installation on acme',
      });
    });

    it('stores a selection in page state', async () => {
      const selection = { state: 'SELECTcanary', installations: [] };
      client.completeGithubApp.and.resolveTo({ selection });
      land(`?code=${CODE}&state=${STATE}`);

      await context.buildController().load();

      expect(state.selection).toEqual(selection);
    });

    it('posts the callback only once across loads', async () => {
      client.completeGithubApp.and.resolveTo(buildIntegration({ type: 'github_app', githubLogin: 'acme' }));
      land(`?code=${CODE}&state=${STATE}`);

      const controller = context.buildController();
      await controller.load();
      await controller.load();

      expect(client.completeGithubApp).toHaveBeenCalledTimes(1);
    });
  });

  describe('#selectInstallation', () => {
    const selection = { state: 'SELECTcanary', installations: [] };

    beforeEach(() => {
      state.selection = selection;
    });

    it('posts the choice, clears the selection and adds the row', async () => {
      const integration = buildIntegration({ id: 'n', type: 'github_app', githubLogin: 'acme' });
      client.selectGithubAppInstallation.and.resolveTo(integration);

      await context.buildController().selectInstallation(selection, 7);

      expect(client.selectGithubAppInstallation).toHaveBeenCalledOnceWith({ state: 'SELECTcanary', installationId: 7 });
      expect(state.selection).toBeNull();
      expect(state.integrations).toEqual([integration]);
    });

    it('clears the selection on failure', async () => {
      client.selectGithubAppInstallation.and.rejectWith(new ApiError(400, 'raw', 'INTEGRATION_REDIRECT_STATE_INVALID'));

      await context.buildController().selectInstallation(selection, 7);

      expect(state.selection).toBeNull();
      expect(state.notice.text).toBe('This GitHub link expired or was already used. Start again.');
    });
  });

  describe('#dispose', () => {
    it('drops a pending selection', () => {
      state.selection = { state: 'SELECTcanary', installations: [] };

      context.buildController().dispose();

      expect(state.selection).toBeNull();
    });
  });
});
