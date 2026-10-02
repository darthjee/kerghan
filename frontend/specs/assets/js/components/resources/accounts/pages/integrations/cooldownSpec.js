import Cooldown from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/cooldown.js';

describe('Cooldown', () => {
  const NOW = Date.parse('2026-10-01T12:00:00.000Z');
  const at = (offset) => new Date(NOW + offset).toISOString();

  describe('.endsAt', () => {
    it('is null without nextTestAt nor row cooldown', () => {
      expect(Cooldown.endsAt({ nextTestAt: null })).toBeNull();
    });

    it('is null for an unparseable nextTestAt', () => {
      expect(Cooldown.endsAt({ nextTestAt: 'soon' })).toBeNull();
    });

    it('is nextTestAt when there is no row cooldown', () => {
      expect(Cooldown.endsAt({ nextTestAt: at(5000) }, {})).toBe(NOW + 5000);
    });

    it('is the latest of nextTestAt and the row cooldown', () => {
      expect(Cooldown.endsAt({ nextTestAt: at(5000) }, { cooldownUntil: NOW + 9000 })).toBe(NOW + 9000);
      expect(Cooldown.endsAt({ nextTestAt: at(9000) }, { cooldownUntil: NOW + 5000 })).toBe(NOW + 9000);
    });

    it('uses the row cooldown alone', () => {
      expect(Cooldown.endsAt({ nextTestAt: null }, { cooldownUntil: NOW + 5000 })).toBe(NOW + 5000);
    });
  });

  describe('.isActive', () => {
    it('is inactive when nextTestAt is null', () => {
      expect(Cooldown.isActive({ nextTestAt: null }, {}, NOW)).toBeFalse();
    });

    it('is inactive when nextTestAt is now or past', () => {
      expect(Cooldown.isActive({ nextTestAt: at(0) }, {}, NOW)).toBeFalse();
      expect(Cooldown.isActive({ nextTestAt: at(-1000) }, {}, NOW)).toBeFalse();
    });

    it('is active when nextTestAt is in the future', () => {
      expect(Cooldown.isActive({ nextTestAt: at(1000) }, {}, NOW)).toBeTrue();
    });

    it('is active while the row cooldown runs', () => {
      expect(Cooldown.isActive({ nextTestAt: null }, { cooldownUntil: NOW + 1000 }, NOW)).toBeTrue();
    });

    it('defaults to the current time and an empty row', () => {
      expect(Cooldown.isActive({ nextTestAt: new Date(Date.now() + 60000).toISOString() })).toBeTrue();
    });
  });
});
