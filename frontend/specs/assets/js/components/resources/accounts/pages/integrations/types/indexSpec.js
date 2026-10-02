import IntegrationTypes from '../../../../../../../../../assets/js/components/resources/accounts/pages/integrations/types/index.js';
import PatType from '../../../../../../../../../assets/js/components/resources/accounts/pages/integrations/types/pat.js';

describe('IntegrationTypes', () => {
  describe('.get', () => {
    it('returns the pat definition', () => {
      expect(IntegrationTypes.get('pat')).toBe(PatType);
    });

    it('returns undefined for a type not implemented yet', () => {
      expect(IntegrationTypes.get('oauth_app')).toBeUndefined();
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
        { type: 'oauth_app' }, { type: 'pat' }, { type: 'github_app' },
      ]);

      expect(available).toEqual([PatType]);
    });

    it('is empty when no implemented type is enabled', () => {
      expect(IntegrationTypes.available([{ type: 'github_app' }])).toEqual([]);
    });
  });

  describe('.reasonText', () => {
    it('is null without a reason', () => {
      expect(IntegrationTypes.reasonText('pat', null)).toBeNull();
    });

    it('uses the type text', () => {
      expect(IntegrationTypes.reasonText('pat', 'bad_credentials')).toContain('GitHub rejected this token');
    });

    it('uses the generic insufficient_permissions text for other types', () => {
      expect(IntegrationTypes.reasonText('oauth_app', 'insufficient_permissions'))
        .toContain('lacks the required permissions');
    });

    it('falls back to the raw code', () => {
      expect(IntegrationTypes.reasonText('pat', 'mystery')).toBe('mystery');
    });
  });
});
