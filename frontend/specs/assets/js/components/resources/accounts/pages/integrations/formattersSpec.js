import IntegrationFormatters from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/formatters.js';

describe('IntegrationFormatters', () => {
  const NOW = Date.parse('2026-10-01T12:00:00.000Z');
  const at = (offset) => new Date(NOW + offset).toISOString();
  const MINUTE = 60 * 1000;
  const DAY = 24 * 60 * MINUTE;

  describe('.date', () => {
    it('formats the UTC date', () => {
      expect(IntegrationFormatters.date('2026-11-01T00:00:00.000Z')).toBe('2026-11-01');
    });
  });

  describe('.relative', () => {
    it('is "just now" under a minute', () => {
      expect(IntegrationFormatters.relative(at(-30000), NOW)).toBe('just now');
    });

    it('counts minutes, hours and days', () => {
      expect(IntegrationFormatters.relative(at(-MINUTE), NOW)).toBe('1 minute ago');
      expect(IntegrationFormatters.relative(at(-5 * MINUTE), NOW)).toBe('5 minutes ago');
      expect(IntegrationFormatters.relative(at(-3 * 60 * MINUTE), NOW)).toBe('3 hours ago');
      expect(IntegrationFormatters.relative(at(-2 * DAY), NOW)).toBe('2 days ago');
    });

    it('defaults to the current time', () => {
      expect(IntegrationFormatters.relative(new Date().toISOString())).toBe('just now');
    });
  });

  describe('.isExpiringSoon', () => {
    it('flags an expiry within 7 days', () => {
      expect(IntegrationFormatters.isExpiringSoon({ status: 'active', expiresAt: at(6 * DAY) }, NOW)).toBeTrue();
      expect(IntegrationFormatters.isExpiringSoon({ status: 'active', expiresAt: at(7 * DAY) }, NOW)).toBeTrue();
    });

    it('does not flag an expiry beyond 7 days', () => {
      expect(IntegrationFormatters.isExpiringSoon({ status: 'active', expiresAt: at(8 * DAY) }, NOW)).toBeFalse();
    });

    it('does not flag an integration without expiry', () => {
      expect(IntegrationFormatters.isExpiringSoon({ status: 'active', expiresAt: null }, NOW)).toBeFalse();
    });

    it('does not flag an already expired integration', () => {
      expect(IntegrationFormatters.isExpiringSoon({ status: 'expired', expiresAt: at(-DAY) }, NOW)).toBeFalse();
    });

    it('defaults to the current time', () => {
      expect(IntegrationFormatters.isExpiringSoon({
        status: 'active', expiresAt: new Date(Date.now() + DAY).toISOString(),
      })).toBeTrue();
    });
  });

  describe('.sharedLogins', () => {
    it('lists logins used by several integrations', () => {
      const shared = IntegrationFormatters.sharedLogins([
        { githubLogin: 'octocat' }, { githubLogin: 'hubot' }, { githubLogin: 'octocat' },
        { githubLogin: null }, { githubLogin: null },
      ]);

      expect([...shared]).toEqual(['octocat']);
    });
  });
});
