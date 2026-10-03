import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import IntegrationsController, { CLOSED_ADD_FORM } from '../../../../../../../../assets/js/components/resources/accounts/pages/controllers/IntegrationsController.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../support/fakeWindow.js';
import { useIntegrationsControllerHarness } from '../../../../../../../support/integrationsControllerHarness.js';

describe('IntegrationsController redirect flow', () => {
  const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize?client_id=Iv1.abc&state=s';
  const context = useIntegrationsControllerHarness();
  let state;
  let client;
  let navigate;

  beforeEach(() => {
    ({ state, client, navigate } = context);
  });

  describe('#create with a redirect-flow type', () => {
    const form = { type: 'oauth_app', label: 'Work', credential: {} };

    beforeEach(() => {
      state.addForm = { ...CLOSED_ADD_FORM, open: true, ...form };
    });

    it('starts the redirect with the label instead of creating', async () => {
      client.startOauthApp.and.resolveTo({ authorizeUrl: AUTHORIZE_URL });

      await context.buildController().create(form);

      expect(client.create).not.toHaveBeenCalled();
      expect(client.startOauthApp).toHaveBeenCalledWith({ label: 'Work' });
      expect(navigate).toHaveBeenCalledWith(AUTHORIZE_URL);
    });

    it('does not follow a non-GitHub authorizeUrl and shows an error', async () => {
      client.startOauthApp.and.resolveTo({ authorizeUrl: 'https://evil.example/login/oauth/authorize?x' });

      await context.buildController().create(form);

      expect(navigate).not.toHaveBeenCalled();
      expect(state.addForm.error).toContain('unexpected authorization address');
      expect(state.addForm.open).toBeTrue();
    });

    it('maps an API error onto the form', async () => {
      client.startOauthApp.and.rejectWith(new ApiError(409, 'raw', 'INTEGRATIONS_LIMIT_REACHED'));

      await context.buildController().create(form);

      expect(state.addForm.error)
        .toBe('You reached the maximum number of integrations. Remove one before adding another.');
    });
  });

  describe('#startRedirect for a reconnect', () => {
    it('starts with the integrationId and navigates', async () => {
      client.startOauthApp.and.resolveTo({ authorizeUrl: AUTHORIZE_URL });

      await context.buildController().startRedirect('oauth_app', { integrationId: 'abc' });

      expect(client.startOauthApp).toHaveBeenCalledWith({ integrationId: 'abc' });
      expect(navigate).toHaveBeenCalledWith(AUTHORIZE_URL);
    });

    it('maps an API error onto the row', async () => {
      client.startOauthApp.and.rejectWith(new ApiError(404, 'Not found', 'NOT_FOUND'));

      await context.buildController().startRedirect('oauth_app', { integrationId: 'abc' });

      expect(state.rowState.get('abc').error).toBe('Not found');
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('default navigate', () => {
    afterEach(() => uninstallFakeWindow());

    it('assigns window.location', () => {
      const assign = jasmine.createSpy('assign');
      installFakeWindow({ location: { assign } });

      new IntegrationsController(context.setters, client).navigate(AUTHORIZE_URL);

      expect(assign).toHaveBeenCalledWith(AUTHORIZE_URL);
    });
  });
});
