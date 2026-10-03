import GithubAppLanding from '../../../../../assets/js/utils/oauth/GithubAppLanding.js';
import OauthAppLanding from '../../../../../assets/js/utils/oauth/OauthAppLanding.js';
import RedirectLandings from '../../../../../assets/js/utils/oauth/RedirectLandings.js';

describe('RedirectLandings', () => {
  let history;
  const capture = (pathname) => RedirectLandings.capture({ pathname, search: '?code=c&state=s' }, history);

  beforeEach(() => {
    history = jasmine.createSpyObj('history', ['replaceState']);
  });

  afterEach(() => {
    OauthAppLanding.take();
    GithubAppLanding.take();
  });

  it('captures the OAuth App landing on its path', () => {
    expect(capture('/integrations/oauth_app/callback')).toBeTrue();
    expect(OauthAppLanding.take()).toEqual({ kind: 'callback', code: 'c', state: 's' });
    expect(GithubAppLanding.take()).toBeNull();
  });

  it('captures the GitHub App landing on its path', () => {
    expect(capture('/integrations/github_app/callback')).toBeTrue();
    expect(GithubAppLanding.take()).toEqual({ kind: 'callback', code: 'c', state: 's' });
    expect(OauthAppLanding.take()).toBeNull();
  });

  it('is a no-op on any other path', () => {
    expect(capture('/')).toBeFalse();
    expect(history.replaceState).not.toHaveBeenCalled();
  });
});
