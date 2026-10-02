import OauthAppType from '../../../../../../../../../assets/js/components/resources/accounts/pages/integrations/types/oauthApp.js';

describe('OauthAppType', () => {
  it('describes itself for the type picker', () => {
    expect(OauthAppType.type).toBe('oauth_app');
    expect(OauthAppType.name).toBe('OAuth App');
    expect(OauthAppType.description).toBe('Connect a GitHub account by authorizing Kerghan\'s OAuth App.');
  });

  it('uses the redirect flow without credential fields', () => {
    expect(OauthAppType.flow).toBe('redirect');
    expect(OauthAppType.credentialFields).toBeUndefined();
  });

  it('warns about repo, organization approval and the 10-authorization limit', () => {
    expect(OauthAppType.warnings.length).toBe(3);
    expect(OauthAppType.warnings[0]).toContain('write access');
    expect(OauthAppType.warnings[1]).toContain('Organizations may need to approve');
    expect(OauthAppType.warnings[2]).toContain('at most 10 authorizations');
  });

  it('reminds that removal tries to revoke on GitHub', () => {
    expect(OauthAppType.removeReminder).toContain('try to revoke this authorization on GitHub');
  });

  describe('.reasonText', () => {
    it('explains revoked', () => {
      expect(OauthAppType.reasonText('revoked')).toBe(
        'GitHub no longer accepts this authorization. It may have been revoked on GitHub, '
        + 'unused for a year, or replaced by newer authorizations. Reconnect to fix it.',
      );
    });

    it('explains insufficient_permissions', () => {
      expect(OauthAppType.reasonText('insufficient_permissions'))
        .toBe('This authorization lacks the `repo` scope. Reconnect with GitHub to grant it.');
    });

    it('is undefined for an unknown reason', () => {
      expect(OauthAppType.reasonText('mystery')).toBeUndefined();
    });
  });
});
