import OauthAppLanding from '../../../../../assets/js/utils/oauth/OauthAppLanding.js';

describe('OauthAppLanding', () => {
  const CODE = 'CODEcanary0000';
  const STATE = 'STATEcanary0000';
  let history;
  const capture = (search, pathname = '/integrations/oauth_app/callback') => OauthAppLanding.capture(
    { pathname, search }, history,
  );

  beforeEach(() => {
    history = jasmine.createSpyObj('history', ['replaceState']);
  });

  afterEach(() => {
    OauthAppLanding.take();
  });

  describe('.capture', () => {
    it('is a no-op outside the callback path', () => {
      expect(capture(`?code=${CODE}&state=${STATE}`, '/')).toBeFalse();
      expect(history.replaceState).not.toHaveBeenCalled();
      expect(OauthAppLanding.take()).toBeNull();
    });

    it('captures code and state and cleans the URL', () => {
      expect(capture(`?code=${CODE}&state=${STATE}`)).toBeTrue();

      expect(history.replaceState).toHaveBeenCalledOnceWith(null, '', '/#/account/integrations');
      expect(OauthAppLanding.take()).toEqual({ kind: 'callback', code: CODE, state: STATE });
    });

    it('treats access_denied as a cancellation', () => {
      capture(`?error=access_denied&error_description=denied&state=${STATE}`);

      expect(history.replaceState).toHaveBeenCalledOnceWith(null, '', '/#/account/integrations');
      expect(OauthAppLanding.take()).toEqual({ kind: 'cancelled' });
    });

    [
      ['another error', `?error=server_error&code=${CODE}&state=${STATE}`],
      ['a missing code', `?state=${STATE}`],
      ['a missing state', `?code=${CODE}`],
      ['no parameters', ''],
    ].forEach(([description, search]) => {
      it(`treats ${description} as a failure, still cleaning the URL`, () => {
        capture(search);

        expect(history.replaceState).toHaveBeenCalledOnceWith(null, '', '/#/account/integrations');
        expect(OauthAppLanding.take()).toEqual({ kind: 'failed' });
      });
    });

    it('never puts the code or state in the cleaned URL', () => {
      capture(`?code=${CODE}&state=${STATE}`);

      expect(JSON.stringify(history.replaceState.calls.allArgs())).not.toContain(CODE);
      expect(JSON.stringify(history.replaceState.calls.allArgs())).not.toContain(STATE);
    });
  });

  describe('.take', () => {
    it('returns the pending result only once', () => {
      capture(`?code=${CODE}&state=${STATE}`);

      expect(OauthAppLanding.take()).toEqual({ kind: 'callback', code: CODE, state: STATE });
      expect(OauthAppLanding.take()).toBeNull();
    });

    it('is null without a capture', () => {
      expect(OauthAppLanding.take()).toBeNull();
    });
  });
});
