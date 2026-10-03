import GithubAppType from '../../../../../../../../../assets/js/components/resources/accounts/pages/integrations/types/githubApp.js';

describe('GithubAppType', () => {
  it('describes itself for the type picker', () => {
    expect(GithubAppType.type).toBe('github_app');
    expect(GithubAppType.name).toBe('GitHub App');
    expect(GithubAppType.description).toBe(
      'Connect a GitHub account or organization by installing Kerghan\'s GitHub App. '
      + 'Read-only access to issues; no token is stored.',
    );
  });

  it('uses the redirect flow with install and connect modes and no credential fields', () => {
    expect(GithubAppType.flow).toBe('redirect');
    expect(GithubAppType.modes).toEqual(['install', 'connect']);
    expect(GithubAppType.credentialFields).toBeUndefined();
  });

  it('warns about read-only access and organization members', () => {
    expect(GithubAppType.warnings.length).toBe(2);
    expect(GithubAppType.warnings[0]).toContain('read access to issues and metadata');
    expect(GithubAppType.warnings[1]).toContain('without admin rights can\'t install it');
  });

  it('hints when to connect an existing installation', () => {
    expect(GithubAppType.connectHint)
      .toBe('Use this if the app is already installed on your account or organization.');
  });

  describe('.removeReminder', () => {
    it('names the installation account', () => {
      expect(GithubAppType.removeReminder({ githubLogin: 'acme' })).toBe(
        'Kerghan\'s GitHub App stays installed on acme, and other connections may still use it. '
        + 'Uninstall it on GitHub if you no longer want it.',
      );
    });

    it('falls back without a login', () => {
      expect(GithubAppType.removeReminder({ githubLogin: null }))
        .toContain('stays installed on its GitHub account');
    });
  });

  describe('.reasonText', () => {
    it('explains uninstalled', () => {
      expect(GithubAppType.reasonText('uninstalled')).toBe(
        'Kerghan\'s GitHub App is no longer installed on this account. Reinstall it and reconnect.',
      );
    });

    it('explains suspended', () => {
      expect(GithubAppType.reasonText('suspended')).toBe(
        'This installation is suspended on GitHub. Unsuspend it in the account\'s GitHub settings, '
        + 'then test again.',
      );
    });

    it('explains insufficient_permissions', () => {
      expect(GithubAppType.reasonText('insufficient_permissions')).toBe(
        'This installation hasn\'t granted Issues and Metadata read access. Accept the app\'s '
        + 'requested permissions on GitHub, then test again.',
      );
    });

    it('is undefined for an unknown reason', () => {
      expect(GithubAppType.reasonText('mystery')).toBeUndefined();
    });
  });

  describe('.errorText', () => {
    it('overrides the redirect state text', () => {
      expect(GithubAppType.errorText('INTEGRATION_REDIRECT_STATE_INVALID'))
        .toBe('This GitHub link expired or was already used. Start again.');
    });

    it('is undefined for other codes', () => {
      expect(GithubAppType.errorText('GITHUB_UNAVAILABLE')).toBeUndefined();
    });
  });

  it('needs the server config for its actions', () => {
    expect(GithubAppType.requiresServerConfig).toBeTrue();
  });

  describe('.details', () => {
    it('lists the account type and repository selection', () => {
      expect(GithubAppType.details({ metadata: { accountType: 'User', repositorySelection: 'all' } }))
        .toEqual(['User', 'all repositories']);
      expect(GithubAppType.details({ metadata: { accountType: 'Organization', repositorySelection: 'selected' } }))
        .toEqual(['Organization', 'selected repositories']);
    });

    it('skips missing values', () => {
      expect(GithubAppType.details({ metadata: null })).toEqual([]);
      expect(GithubAppType.details({ metadata: { repositorySelection: 'other' } })).toEqual([]);
    });
  });
});
