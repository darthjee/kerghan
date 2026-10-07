import AuthSession from '../../../../assets/js/client/AuthSession.js';

describe('AuthSession', () => {
  describe('.readCookies', () => {
    it('returns an empty string when there is no document', () => {
      expect(AuthSession.readCookies()).toBe('');
    });
  });

  describe('.isLoggedIn', () => {
    it('returns false when there are no cookies', () => {
      spyOn(AuthSession, 'readCookies').and.returnValue('');

      expect(AuthSession.isLoggedIn()).toBe(false);
    });

    it('returns true when the logged_in=1 hint cookie is present', () => {
      spyOn(AuthSession, 'readCookies').and.returnValue('foo=bar; logged_in=1; baz=qux');

      expect(AuthSession.isLoggedIn()).toBe(true);
    });

    it('returns true when logged_in=1 is the only cookie', () => {
      spyOn(AuthSession, 'readCookies').and.returnValue('logged_in=1');

      expect(AuthSession.isLoggedIn()).toBe(true);
    });

    it('returns false when logged_in has another value', () => {
      spyOn(AuthSession, 'readCookies').and.returnValue('logged_in=0; not_logged_in=1');

      expect(AuthSession.isLoggedIn()).toBe(false);
    });
  });

  describe('.takeLegacyToken', () => {
    afterEach(() => {
      AuthSession.storage().removeItem('kerghan_refresh_token');
    });

    it('returns null when no legacy token is stored', () => {
      expect(AuthSession.takeLegacyToken()).toBeNull();
    });

    it('returns the legacy token and removes it', () => {
      AuthSession.storage().setItem('kerghan_refresh_token', 'legacy-token');

      expect(AuthSession.takeLegacyToken()).toBe('legacy-token');
      expect(AuthSession.storage().getItem('kerghan_refresh_token')).toBeNull();
      expect(AuthSession.takeLegacyToken()).toBeNull();
    });
  });
});
