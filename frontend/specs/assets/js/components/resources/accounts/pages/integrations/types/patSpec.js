import PatType from '../../../../../../../../../assets/js/components/resources/accounts/pages/integrations/types/pat.js';

describe('PatType', () => {
  it('describes itself for the type picker', () => {
    expect(PatType.type).toBe('pat');
    expect(PatType.flow).toBe('paste');
    expect(PatType.description).toBe('Paste a GitHub personal access token (classic or fine-grained).');
  });

  it('has a single token credential field', () => {
    expect(PatType.credentialFields).toEqual([{ name: 'token', label: 'Token' }]);
  });

  describe('.buildCredential', () => {
    it('builds the token credential', () => {
      expect(PatType.buildCredential({ token: 'ghp_abc' })).toEqual({ token: 'ghp_abc' });
    });

    it('defaults a missing token to an empty string', () => {
      expect(PatType.buildCredential({})).toEqual({ token: '' });
    });
  });

  describe('.reasonText', () => {
    it('explains bad_credentials', () => {
      expect(PatType.reasonText('bad_credentials')).toContain('revoked or deleted');
    });

    it('explains insufficient_permissions', () => {
      expect(PatType.reasonText('insufficient_permissions')).toContain('`repo` scope');
    });

    it('is undefined for an unknown reason', () => {
      expect(PatType.reasonText('mystery')).toBeUndefined();
    });
  });
});
