import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import GithubAppFlow from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/githubAppFlow.js';
import RedirectShared from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/redirectShared.js';
import GithubAppLanding from '../../../../../../../../assets/js/utils/oauth/GithubAppLanding.js';

describe('GithubAppFlow', () => {
  const INSTALL_URL = 'https://github.com/apps/kerghan-dev/installations/new?state=s';
  const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize?client_id=Iv1.abc&state=s';
  const CODE = 'CODEcanary0000';
  const STATE = 'STATEcanary0000';
  const SELECT_STATE = 'SELECTcanary0000';
  let controller;
  let history;

  const land = (search) => GithubAppLanding.capture(
    { pathname: '/integrations/github_app/callback', search }, history,
  );

  beforeEach(() => {
    history = jasmine.createSpyObj('history', ['replaceState']);
    controller = {
      client: jasmine.createSpyObj('client', [
        'startGithubApp', 'completeGithubApp', 'selectGithubAppInstallation',
      ]),
      navigate: jasmine.createSpy('navigate'),
      patchRow: jasmine.createSpy('patchRow'),
      patchAddForm: jasmine.createSpy('patchAddForm'),
      setIntegrations: jasmine.createSpy('setIntegrations'),
      setNotice: jasmine.createSpy('setNotice'),
      setSelection: jasmine.createSpy('setSelection'),
    };
  });

  afterEach(() => {
    GithubAppLanding.take();
  });

  describe('.isGithubAppUrl', () => {
    it('accepts the app installation page', () => {
      expect(GithubAppFlow.isGithubAppUrl(INSTALL_URL)).toBeTrue();
    });

    it('accepts GitHub\'s authorize page', () => {
      expect(GithubAppFlow.isGithubAppUrl(AUTHORIZE_URL)).toBeTrue();
    });

    [
      'https://github.com/apps/kerghan/installations/new',
      'https://github.com/apps/Kerghan/installations/new?state=s',
      'https://github.com/apps/kerghan/installations/new/../x?state=s',
      'https://github.com/apps/a/b/installations/new?state=s',
      'http://github.com/apps/kerghan/installations/new?state=s',
      'https://github.com.evil.example/apps/kerghan/installations/new?state=s',
      'https://evil.example/login/oauth/authorize?x=1',
      'https://github.com/login/oauth/authorize',
      'javascript:alert(1)',
      '',
      undefined,
      null,
      42,
    ].forEach((url) => {
      it(`rejects ${String(url)}`, () => {
        expect(GithubAppFlow.isGithubAppUrl(url)).toBeFalse();
      });
    });
  });

  describe('.start', () => {
    it('posts the label and mode and navigates to the install URL', async () => {
      controller.client.startGithubApp.and.resolveTo({ redirectUrl: INSTALL_URL });

      await GithubAppFlow.start(controller, { label: 'Work', mode: 'install' });

      expect(controller.client.startGithubApp).toHaveBeenCalledWith({ label: 'Work', mode: 'install' });
      expect(controller.patchAddForm).toHaveBeenCalledWith({ error: null });
      expect(controller.navigate).toHaveBeenCalledWith(INSTALL_URL);
    });

    it('navigates to the authorize URL for a reconnect in connect mode', async () => {
      controller.client.startGithubApp.and.resolveTo({ redirectUrl: AUTHORIZE_URL });

      await GithubAppFlow.start(controller, { integrationId: 'abc', mode: 'connect' });

      expect(controller.patchRow).toHaveBeenCalledWith('abc', { error: null });
      expect(controller.navigate).toHaveBeenCalledWith(AUTHORIZE_URL);
    });

    it('does not follow an unexpected URL', async () => {
      controller.client.startGithubApp.and.resolveTo({ redirectUrl: 'https://evil.example/?x=1' });

      await GithubAppFlow.start(controller, { label: 'Work', mode: 'install' });

      expect(controller.navigate).not.toHaveBeenCalled();
      expect(controller.patchAddForm).toHaveBeenCalledWith({ error: RedirectShared.UNEXPECTED_URL_MESSAGE });
    });

    it('does not read the OAuth App field', async () => {
      controller.client.startGithubApp.and.resolveTo({ authorizeUrl: AUTHORIZE_URL });

      await GithubAppFlow.start(controller, { label: 'Work', mode: 'install' });

      expect(controller.navigate).not.toHaveBeenCalled();
    });

    it('changes nothing when the session expired', async () => {
      controller.client.startGithubApp.and.resolveTo(undefined);

      await GithubAppFlow.start(controller, { label: 'Work', mode: 'install' });

      expect(controller.navigate).not.toHaveBeenCalled();
      expect(controller.patchAddForm).toHaveBeenCalledOnceWith({ error: null });
    });

    it('maps an API error onto the row', async () => {
      controller.client.startGithubApp.and.rejectWith(new ApiError(423, 'raw', 'INTEGRATION_CREDENTIAL_LOCKED'));

      await GithubAppFlow.start(controller, { integrationId: 'abc', mode: 'install' });

      expect(controller.patchRow).toHaveBeenCalledWith('abc', {
        error: 'Too many failed attempts. Wait a while before trying again.',
      });
    });
  });

  describe('.completeLanding', () => {
    it('does nothing without a landing', async () => {
      await GithubAppFlow.completeLanding(controller);

      expect(controller.client.completeGithubApp).not.toHaveBeenCalled();
      expect(controller.setNotice).not.toHaveBeenCalled();
    });

    [
      ['?error=access_denied', { variant: 'warning', text: 'You cancelled the GitHub authorization.' }],
      ['?setup_action=request', {
        variant: 'info',
        text: 'Waiting for an organization owner to approve the installation. Once they do, use '
          + '"Connect existing installation".',
      }],
      [`?code=${CODE}`, { variant: 'danger', text: 'GitHub didn\'t complete the installation. Try again.' }],
    ].forEach(([search, notice]) => {
      it(`shows its notice without a call for ${search}`, async () => {
        land(search);

        await GithubAppFlow.completeLanding(controller);

        expect(controller.client.completeGithubApp).not.toHaveBeenCalled();
        expect(controller.setNotice).toHaveBeenCalledOnceWith(notice);
      });
    });

    it('posts an install callback and shows the connected row', async () => {
      const integration = { id: 'n', type: 'github_app', githubLogin: 'acme' };
      controller.client.completeGithubApp.and.resolveTo(integration);
      land(`?code=${CODE}&installation_id=12345678&setup_action=install&state=${STATE}`);

      await GithubAppFlow.completeLanding(controller);

      expect(controller.client.completeGithubApp).toHaveBeenCalledOnceWith({
        code: CODE, state: STATE, installationId: 12345678, setupAction: 'install',
      });
      expect(controller.setIntegrations.calls.mostRecent().args[0]([{ id: 'o' }])).toEqual([integration, { id: 'o' }]);
      expect(controller.setNotice).toHaveBeenCalledWith({
        variant: 'success', text: 'Connected to the GitHub App installation on acme',
      });
    });

    it('hands a selection to page state', async () => {
      const selection = { state: SELECT_STATE, installations: [{ installationId: 1, accountLogin: 'a', accountType: 'User' }] };
      controller.client.completeGithubApp.and.resolveTo({ selection });
      land(`?code=${CODE}&state=${STATE}`);

      await GithubAppFlow.completeLanding(controller);

      expect(controller.client.completeGithubApp).toHaveBeenCalledOnceWith({
        code: CODE, state: STATE, installationId: undefined, setupAction: undefined,
      });
      expect(controller.setSelection).toHaveBeenCalledOnceWith(selection);
      expect(controller.setIntegrations).not.toHaveBeenCalled();
      expect(controller.setNotice).not.toHaveBeenCalled();
    });

    it('maps the invalid state with the github_app text', async () => {
      controller.client.completeGithubApp.and.rejectWith(new ApiError(400, 'raw', 'INTEGRATION_REDIRECT_STATE_INVALID'));
      land(`?code=${CODE}&state=${STATE}`);

      await GithubAppFlow.completeLanding(controller);

      expect(controller.setNotice).toHaveBeenCalledOnceWith({
        variant: 'danger', text: 'This GitHub link expired or was already used. Start again.',
      });
    });

    it('changes nothing when the session expired', async () => {
      controller.client.completeGithubApp.and.resolveTo(undefined);
      land(`?code=${CODE}&state=${STATE}`);

      await GithubAppFlow.completeLanding(controller);

      expect(controller.setNotice).not.toHaveBeenCalled();
      expect(controller.setSelection).not.toHaveBeenCalled();
    });
  });

  describe('.select', () => {
    const selection = { state: SELECT_STATE, installations: [] };

    it('clears the selection before posting, then shows the connected row', async () => {
      controller.client.selectGithubAppInstallation.and.callFake(async () => {
        expect(controller.setSelection).toHaveBeenCalledOnceWith(null);
        return { id: 'n', githubLogin: 'acme' };
      });

      await GithubAppFlow.select(controller, selection, 7);

      expect(controller.client.selectGithubAppInstallation).toHaveBeenCalledOnceWith({
        state: SELECT_STATE, installationId: 7,
      });
      expect(controller.setNotice).toHaveBeenCalledWith({
        variant: 'success', text: 'Connected to the GitHub App installation on acme',
      });
    });

    it('clears the selection and maps the error on failure', async () => {
      controller.client.selectGithubAppInstallation.and.rejectWith(
        new ApiError(422, 'raw', 'INTEGRATION_INSTALLATION_NOT_ACCESSIBLE'),
      );

      await GithubAppFlow.select(controller, selection, 7);

      expect(controller.setSelection).toHaveBeenCalledOnceWith(null);
      expect(controller.setNotice.calls.mostRecent().args[0].text).toContain('can\'t access that installation');
    });
  });
});
