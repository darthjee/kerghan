import GithubAppType from '../../../../../../../../../assets/js/components/resources/accounts/pages/integrations/types/githubApp.js';
import IntegrationTypes from '../../../../../../../../../assets/js/components/resources/accounts/pages/integrations/types/index.js';
import OauthAppType from '../../../../../../../../../assets/js/components/resources/accounts/pages/integrations/types/oauthApp.js';
import PatType from '../../../../../../../../../assets/js/components/resources/accounts/pages/integrations/types/pat.js';

describe('IntegrationTypes', () => {
  describe('.get', () => {
    it('returns the pat definition', () => {
      expect(IntegrationTypes.get('pat')).toBe(PatType);
    });

    it('returns the oauth_app definition', () => {
      expect(IntegrationTypes.get('oauth_app')).toBe(OauthAppType);
    });

    it('returns the github_app definition', () => {
      expect(IntegrationTypes.get('github_app')).toBe(GithubAppType);
    });

    it('returns undefined for a type not implemented', () => {
      expect(IntegrationTypes.get('other')).toBeUndefined();
    });
  });

  describe('.nameOf', () => {
    it('names every known type', () => {
      expect(IntegrationTypes.nameOf('pat')).toBe('Personal Access Token');
      expect(IntegrationTypes.nameOf('oauth_app')).toBe('OAuth App');
      expect(IntegrationTypes.nameOf('github_app')).toBe('GitHub App');
    });

    it('falls back to the raw type', () => {
      expect(IntegrationTypes.nameOf('other')).toBe('other');
    });
  });

  describe('.available', () => {
    it('intersects the enabled types with the implemented ones', () => {
      const available = IntegrationTypes.available([
        { type: 'oauth_app' }, { type: 'pat' }, { type: 'github_app' }, { type: 'other' },
      ]);

      expect(available).toEqual([OauthAppType, PatType, GithubAppType]);
    });

    it('includes oauth_app only when the server lists it', () => {
      expect(IntegrationTypes.available([{ type: 'pat' }])).toEqual([PatType]);
      expect(IntegrationTypes.available([{ type: 'pat' }, { type: 'oauth_app' }]))
        .toEqual([PatType, OauthAppType]);
    });

    it('is empty when no implemented type is enabled', () => {
      expect(IntegrationTypes.available([{ type: 'other' }])).toEqual([]);
    });

    it('includes github_app only when the server lists it', () => {
      expect(IntegrationTypes.available([{ type: 'pat' }, { type: 'github_app' }]))
        .toEqual([PatType, GithubAppType]);
    });
  });

  describe('.reasonText', () => {
    it('is null without a reason', () => {
      expect(IntegrationTypes.reasonText('pat', null)).toBeNull();
    });

    it('uses the type text', () => {
      expect(IntegrationTypes.reasonText('pat', 'bad_credentials')).toContain('GitHub rejected this token');
    });

    it('uses the oauth_app texts', () => {
      expect(IntegrationTypes.reasonText('oauth_app', 'revoked')).toContain('Reconnect to fix it');
      expect(IntegrationTypes.reasonText('oauth_app', 'insufficient_permissions'))
        .toContain('Reconnect with GitHub to grant it');
    });

    it('uses the generic insufficient_permissions text for types without their own', () => {
      expect(IntegrationTypes.reasonText('other', 'insufficient_permissions'))
        .toContain('lacks the required permissions');
    });

    it('uses the github_app texts', () => {
      expect(IntegrationTypes.reasonText('github_app', 'uninstalled')).toContain('no longer installed');
      expect(IntegrationTypes.reasonText('github_app', 'insufficient_permissions'))
        .toContain('Issues and Metadata read access');
    });

    it('falls back to the raw code', () => {
      expect(IntegrationTypes.reasonText('pat', 'mystery')).toBe('mystery');
    });
  });

  describe('.removeReminderFor', () => {
    it('returns a fixed reminder', () => {
      expect(IntegrationTypes.removeReminderFor({ type: 'pat' })).toBe(PatType.removeReminder);
      expect(IntegrationTypes.removeReminderFor({ type: 'oauth_app' })).toBe(OauthAppType.removeReminder);
    });

    it('builds the reminder from the integration', () => {
      expect(IntegrationTypes.removeReminderFor({ type: 'github_app', githubLogin: 'acme' }))
        .toContain('stays installed on acme');
    });

    it('is undefined for a type not implemented', () => {
      expect(IntegrationTypes.removeReminderFor({ type: 'other' })).toBeUndefined();
    });
  });

  describe('.detailsOf', () => {
    it('uses the type details', () => {
      expect(IntegrationTypes.detailsOf({ type: 'github_app', metadata: { accountType: 'User', repositorySelection: 'all' } }))
        .toEqual(['User', 'all repositories']);
    });

    it('is empty for a type without details', () => {
      expect(IntegrationTypes.detailsOf({ type: 'pat' })).toEqual([]);
      expect(IntegrationTypes.detailsOf({ type: 'other' })).toEqual([]);
    });
  });
});
