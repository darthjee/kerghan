import GithubAppLanding from '../../../../../assets/js/utils/oauth/GithubAppLanding.js';

describe('GithubAppLanding', () => {
  const CODE = 'CODEcanary0000';
  const STATE = 'STATEcanary0000';
  const TARGET = '/#/account/integrations';
  let history;
  const capture = (search, pathname = '/integrations/github_app/callback') => GithubAppLanding.capture(
    { pathname, search }, history,
  );

  beforeEach(() => {
    history = jasmine.createSpyObj('history', ['replaceState']);
  });

  afterEach(() => {
    GithubAppLanding.take();
  });

  it('owns the github_app callback path', () => {
    expect(GithubAppLanding.path).toBe('/integrations/github_app/callback');
  });

  describe('.capture', () => {
    it('is a no-op outside the callback path', () => {
      expect(capture(`?code=${CODE}&state=${STATE}`, '/integrations/oauth_app/callback')).toBeFalse();
      expect(history.replaceState).not.toHaveBeenCalled();
      expect(GithubAppLanding.take()).toBeNull();
    });

    it('cleans the URL before anything else is kept', () => {
      history.replaceState.and.callFake(() => {
        expect(GithubAppLanding.take()).toBeNull();
      });

      expect(capture(`?code=${CODE}&state=${STATE}`)).toBeTrue();
      expect(history.replaceState).toHaveBeenCalledOnceWith(null, '', TARGET);
    });

    it('captures an install callback with the installation id as a number', () => {
      capture(`?code=${CODE}&installation_id=12345678&setup_action=install&state=${STATE}`);

      expect(GithubAppLanding.take()).toEqual({
        kind: 'callback', code: CODE, state: STATE, installationId: 12345678, setupAction: 'install',
      });
    });

    it('captures an update callback', () => {
      capture(`?code=${CODE}&installation_id=42&setup_action=update&state=${STATE}`);

      expect(GithubAppLanding.take()).toEqual({
        kind: 'callback', code: CODE, state: STATE, installationId: 42, setupAction: 'update',
      });
    });

    it('captures a connect callback without installation values', () => {
      capture(`?code=${CODE}&state=${STATE}`);

      expect(GithubAppLanding.take()).toEqual({ kind: 'callback', code: CODE, state: STATE });
    });

    it('treats access_denied as a cancellation', () => {
      capture(`?error=access_denied&error_description=denied&state=${STATE}`);

      expect(history.replaceState).toHaveBeenCalledOnceWith(null, '', TARGET);
      expect(GithubAppLanding.take()).toEqual({ kind: 'cancelled' });
    });

    it('treats setup_action=request as a pending owner approval', () => {
      capture(`?setup_action=request&state=${STATE}`);

      expect(history.replaceState).toHaveBeenCalledOnceWith(null, '', TARGET);
      expect(GithubAppLanding.take()).toEqual({ kind: 'requested' });
    });

    [
      ['another error', `?error=server_error&code=${CODE}&state=${STATE}`],
      ['a missing code', `?state=${STATE}`],
      ['a missing state', `?code=${CODE}`],
      ['no parameters', ''],
      ['an unknown setup_action', `?code=${CODE}&state=${STATE}&installation_id=1&setup_action=other`],
      ['a zero installation_id', `?code=${CODE}&state=${STATE}&installation_id=0&setup_action=install`],
      ['a negative installation_id', `?code=${CODE}&state=${STATE}&installation_id=-5&setup_action=install`],
      ['a decimal installation_id', `?code=${CODE}&state=${STATE}&installation_id=1.5&setup_action=install`],
      ['a non-numeric installation_id', `?code=${CODE}&state=${STATE}&installation_id=abc&setup_action=install`],
      ['an unsafe installation_id', `?code=${CODE}&state=${STATE}&installation_id=9007199254740993&setup_action=install`],
      ['an installation_id without setup_action', `?code=${CODE}&state=${STATE}&installation_id=5`],
      ['a setup_action without installation_id', `?code=${CODE}&state=${STATE}&setup_action=install`],
    ].forEach(([description, search]) => {
      it(`treats ${description} as a failure, still cleaning the URL`, () => {
        capture(search);

        expect(history.replaceState).toHaveBeenCalledOnceWith(null, '', TARGET);
        expect(GithubAppLanding.take()).toEqual({ kind: 'failed' });
      });
    });

    it('never puts the code or state in the URL or console', () => {
      const consoleSpies = ['log', 'info', 'warn', 'error', 'debug'].map((name) => spyOn(console, name));

      capture(`?code=${CODE}&installation_id=7&setup_action=install&state=${STATE}`);

      const urls = JSON.stringify(history.replaceState.calls.allArgs());

      expect(urls).not.toContain(CODE);
      expect(urls).not.toContain(STATE);
      consoleSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    });
  });

  describe('.take', () => {
    it('returns the pending result only once', () => {
      capture(`?code=${CODE}&state=${STATE}`);

      expect(GithubAppLanding.take()).toEqual({ kind: 'callback', code: CODE, state: STATE });
      expect(GithubAppLanding.take()).toBeNull();
    });

    it('is null without a capture', () => {
      expect(GithubAppLanding.take()).toBeNull();
    });
  });
});
