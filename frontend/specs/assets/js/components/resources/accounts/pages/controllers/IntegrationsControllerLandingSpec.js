import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import OauthAppLanding from '../../../../../../../../assets/js/utils/oauth/OauthAppLanding.js';
import { buildIntegration, useIntegrationsControllerHarness } from '../../../../../../../support/integrationsControllerHarness.js';

describe('IntegrationsController OAuth App landing', () => {
  const CODE = 'CODEcanary0000';
  const STATE = 'STATEcanary0000';
  const context = useIntegrationsControllerHarness();
  let history;
  let client;
  let state;
  let storage;
  let consoleSpies;
  let originalStorages;

  const land = (search) => OauthAppLanding.capture(
    { pathname: '/integrations/oauth_app/callback', search }, history,
  );
  const load = () => context.buildController().load();

  beforeEach(() => {
    ({ client, state } = context);
    history = jasmine.createSpyObj('history', ['replaceState']);
    client.listMine.and.resolveTo({ integrations: [] });
    client.listTypes.and.resolveTo({ types: [] });
    consoleSpies = ['log', 'info', 'warn', 'error', 'debug'].map((method) => spyOn(console, method));
    storage = jasmine.createSpyObj('storage', ['setItem', 'getItem', 'removeItem']);
    originalStorages = ['localStorage', 'sessionStorage'].map(
      (name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)],
    );
    originalStorages.forEach(([name]) => Object.defineProperty(
      globalThis, name, { value: storage, configurable: true, writable: true },
    ));
  });

  afterEach(() => {
    OauthAppLanding.take();
    originalStorages.forEach(([name, descriptor]) => {
      if (descriptor) {
        Object.defineProperty(globalThis, name, descriptor);
      } else {
        delete globalThis[name];
      }
    });
  });

  const expectCanariesNeverLeaked = () => {
    const seen = JSON.stringify([
      ...consoleSpies.map((spy) => spy.calls.allArgs()),
      storage.setItem.calls.allArgs(),
      history.replaceState.calls.allArgs(),
      state.notice,
      state.integrations,
      [...state.rowState.values()],
      state.addForm,
    ]);

    expect(seen).not.toContain(CODE);
    expect(seen).not.toContain(STATE);
  };

  it('makes no callback call and shows nothing without a landing', async () => {
    await load();

    expect(client.completeOauthApp).not.toHaveBeenCalled();
    expect(state.notice).toBeNull();
    expect(client.listMine).toHaveBeenCalled();
  });

  it('cleans the URL before posting the callback, then loads the list', async () => {
    client.completeOauthApp.and.resolveTo(buildIntegration({ type: 'oauth_app', githubLogin: 'octocat' }));
    land(`?code=${CODE}&state=${STATE}`);

    await load();

    expect(history.replaceState).toHaveBeenCalledBefore(client.completeOauthApp);
    expect(client.completeOauthApp).toHaveBeenCalledOnceWith({ code: CODE, state: STATE });
    expect(client.completeOauthApp).toHaveBeenCalledBefore(client.listMine);
  });

  it('shows "Connected to GitHub as <login>" on success', async () => {
    client.completeOauthApp.and.resolveTo(buildIntegration({ type: 'oauth_app', githubLogin: 'octocat' }));
    client.listMine.and.resolveTo(undefined);
    land(`?code=${CODE}&state=${STATE}`);

    await load();

    expect(state.notice).toEqual({ variant: 'success', text: 'Connected to GitHub as octocat' });
    expect(state.integrations.map(({ id }) => id)).toEqual(['abc-123']);
    expectCanariesNeverLeaked();
  });

  it('replaces a reconnected row in place', async () => {
    const updated = buildIntegration({ id: 'b', type: 'oauth_app', githubLogin: 'octocat' });
    state.integrations = [buildIntegration({ id: 'a' }), buildIntegration({ id: 'b', label: 'Old' })];
    client.completeOauthApp.and.resolveTo(updated);
    client.listMine.and.resolveTo(undefined);
    land(`?code=${CODE}&state=${STATE}`);

    await load();

    expect(state.integrations.map(({ id }) => id)).toEqual(['a', 'b']);
    expect(state.integrations[1]).toBe(updated);
  });

  it('maps a callback error, including the invalid state', async () => {
    client.completeOauthApp.and.rejectWith(
      new ApiError(400, 'raw', 'INTEGRATION_REDIRECT_STATE_INVALID'),
    );
    land(`?code=${CODE}&state=${STATE}`);

    await load();

    expect(state.notice).toEqual({
      variant: 'danger', text: 'This GitHub authorization link expired or was already used. Start again.',
    });
    expect(client.listMine).toHaveBeenCalled();
    expectCanariesNeverLeaked();
  });

  it('shows nothing more when the session turned out to be expired', async () => {
    client.completeOauthApp.and.resolveTo(undefined);
    land(`?code=${CODE}&state=${STATE}`);

    await load();

    expect(state.notice).toBeNull();
    expectCanariesNeverLeaked();
  });

  it('shows the cancellation without any callback call', async () => {
    land(`?error=access_denied&state=${STATE}`);

    await load();

    expect(client.completeOauthApp).not.toHaveBeenCalled();
    expect(state.notice).toEqual({ variant: 'warning', text: 'You cancelled the GitHub authorization.' });
    expectCanariesNeverLeaked();
  });

  [
    ['another error', `?error=server_error&state=${STATE}`],
    ['a missing code', `?state=${STATE}`],
    ['a missing state', `?code=${CODE}`],
  ].forEach(([description, search]) => {
    it(`shows the failure for ${description} without any callback call`, async () => {
      land(search);

      await load();

      expect(client.completeOauthApp).not.toHaveBeenCalled();
      expect(state.notice).toEqual({
        variant: 'danger', text: 'GitHub didn\'t complete the authorization. Try again.',
      });
      expectCanariesNeverLeaked();
    });
  });

  it('posts the callback only once across loads', async () => {
    client.completeOauthApp.and.resolveTo(buildIntegration({ type: 'oauth_app', githubLogin: 'octocat' }));
    land(`?code=${CODE}&state=${STATE}`);

    await load();
    await load();

    expect(client.completeOauthApp).toHaveBeenCalledTimes(1);
  });
});
