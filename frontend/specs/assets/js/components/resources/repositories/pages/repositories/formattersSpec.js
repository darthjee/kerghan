import Formatters from '../../../../../../../../assets/js/components/resources/repositories/pages/repositories/formatters.js';

describe('Formatters', () => {
  describe('.countdown', () => {
    it('formats minutes and seconds', () => {
      expect(Formatters.countdown(154000)).toBe('2m 34s');
    });

    it('formats under a minute as seconds only', () => {
      expect(Formatters.countdown(45000)).toBe('45s');
    });

    it('rounds partial seconds up', () => {
      expect(Formatters.countdown(1200)).toBe('2s');
    });

    it('reads 0s for a non-positive duration', () => {
      expect(Formatters.countdown(-5)).toBe('0s');
    });
  });

  describe('.ago', () => {
    const now = Date.parse('2026-11-07T12:00:00Z');

    it('reads never without a moment', () => {
      expect(Formatters.ago(null, now)).toBe('never');
    });

    it('reads just now under a minute', () => {
      expect(Formatters.ago('2026-11-07T11:59:30Z', now)).toBe('just now');
    });

    it('reads minutes', () => {
      expect(Formatters.ago('2026-11-07T11:55:00Z', now)).toBe('5 min ago');
    });

    it('reads hours', () => {
      expect(Formatters.ago('2026-11-07T09:00:00Z', now)).toBe('3 h ago');
    });

    it('reads days', () => {
      expect(Formatters.ago('2026-11-04T12:00:00Z', now)).toBe('3 d ago');
    });
  });

  describe('.githubUrl', () => {
    it('builds the github.com URL', () => {
      expect(Formatters.githubUrl('darthjee', 'kerghan')).toBe('https://github.com/darthjee/kerghan');
    });

    it('URL-encodes both segments', () => {
      expect(Formatters.githubUrl('a/b', 'x?y')).toBe('https://github.com/a%2Fb/x%3Fy');
    });
  });
});
