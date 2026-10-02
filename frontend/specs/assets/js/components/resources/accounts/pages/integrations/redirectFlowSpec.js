import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import RedirectFlow from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/redirectFlow.js';

describe('RedirectFlow', () => {
  const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize?client_id=Iv1.abc&state=s';
  let controller;

  beforeEach(() => {
    controller = {
      client: jasmine.createSpyObj('client', ['startOauthApp']),
      navigate: jasmine.createSpy('navigate'),
      patchRow: jasmine.createSpy('patchRow'),
      patchAddForm: jasmine.createSpy('patchAddForm'),
    };
  });

  describe('.isGithubAuthorizeUrl', () => {
    it('accepts GitHub\'s authorize page with a query', () => {
      expect(RedirectFlow.isGithubAuthorizeUrl(AUTHORIZE_URL)).toBeTrue();
    });

    [
      'https://evil.example/login/oauth/authorize?x=1',
      'http://github.com/login/oauth/authorize?x=1',
      'https://github.com/login/oauth/authorize',
      'https://github.com.evil.example/login/oauth/authorize?x=1',
      'javascript:alert(1)',
      '',
      undefined,
      null,
      42,
    ].forEach((url) => {
      it(`rejects ${String(url)}`, () => {
        expect(RedirectFlow.isGithubAuthorizeUrl(url)).toBeFalse();
      });
    });
  });

  describe('.start for a create', () => {
    it('posts the label and navigates to the authorize URL', async () => {
      controller.client.startOauthApp.and.resolveTo({ authorizeUrl: AUTHORIZE_URL });

      await RedirectFlow.start(controller, { label: 'Work' });

      expect(controller.client.startOauthApp).toHaveBeenCalledWith({ label: 'Work' });
      expect(controller.navigate).toHaveBeenCalledWith(AUTHORIZE_URL);
      expect(controller.patchAddForm).toHaveBeenCalledWith({ error: null });
    });

    it('does not follow a non-GitHub URL and shows an error on the form', async () => {
      controller.client.startOauthApp.and.resolveTo({ authorizeUrl: 'https://evil.example/?x=1' });

      await RedirectFlow.start(controller, { label: 'Work' });

      expect(controller.navigate).not.toHaveBeenCalled();
      expect(controller.patchAddForm).toHaveBeenCalledWith({ error: RedirectFlow.UNEXPECTED_URL_MESSAGE });
    });

    it('does not follow a missing URL', async () => {
      controller.client.startOauthApp.and.resolveTo({});

      await RedirectFlow.start(controller, { label: 'Work' });

      expect(controller.navigate).not.toHaveBeenCalled();
      expect(controller.patchAddForm).toHaveBeenCalledWith({ error: RedirectFlow.UNEXPECTED_URL_MESSAGE });
    });

    it('maps API errors onto the form', async () => {
      controller.client.startOauthApp.and.rejectWith(new ApiError(409, 'raw', 'INTEGRATION_LABEL_TAKEN'));

      await RedirectFlow.start(controller, { label: 'Work' });

      expect(controller.navigate).not.toHaveBeenCalled();
      expect(controller.patchAddForm)
        .toHaveBeenCalledWith({ error: 'You already have an integration with this label. Choose another one.' });
      expect(controller.patchRow).not.toHaveBeenCalled();
    });

    it('does nothing more when the session turned out to be expired', async () => {
      controller.client.startOauthApp.and.resolveTo(undefined);

      await RedirectFlow.start(controller, { label: 'Work' });

      expect(controller.navigate).not.toHaveBeenCalled();
      expect(controller.patchAddForm).toHaveBeenCalledTimes(1);
    });
  });

  describe('.start for a reconnect', () => {
    it('posts the integrationId and navigates', async () => {
      controller.client.startOauthApp.and.resolveTo({ authorizeUrl: AUTHORIZE_URL });

      await RedirectFlow.start(controller, { integrationId: 'abc' });

      expect(controller.client.startOauthApp).toHaveBeenCalledWith({ integrationId: 'abc' });
      expect(controller.navigate).toHaveBeenCalledWith(AUTHORIZE_URL);
      expect(controller.patchRow).toHaveBeenCalledWith('abc', { error: null });
    });

    it('maps API errors onto the row', async () => {
      controller.client.startOauthApp.and.rejectWith(new ApiError(423, 'raw', 'INTEGRATION_CREDENTIAL_LOCKED'));

      await RedirectFlow.start(controller, { integrationId: 'abc' });

      expect(controller.patchRow)
        .toHaveBeenCalledWith('abc', { error: 'Too many failed attempts. Wait a while before trying again.' });
      expect(controller.patchAddForm).not.toHaveBeenCalled();
    });

    it('shows a non-GitHub URL error on the row', async () => {
      controller.client.startOauthApp.and.resolveTo({ authorizeUrl: 'https://evil.example/?x=1' });

      await RedirectFlow.start(controller, { integrationId: 'abc' });

      expect(controller.navigate).not.toHaveBeenCalled();
      expect(controller.patchRow).toHaveBeenCalledWith('abc', { error: RedirectFlow.UNEXPECTED_URL_MESSAGE });
    });
  });
});
