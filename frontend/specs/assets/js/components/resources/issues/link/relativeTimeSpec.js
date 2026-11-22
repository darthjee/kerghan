import RelativeTime from '../../../../../../../assets/js/components/resources/issues/link/relativeTime.js';

describe('RelativeTime', () => {
  const now = Date.parse('2026-11-07T12:00:00.000Z');

  describe('.ago', () => {
    it('reuses the repositories wording', () => {
      expect(RelativeTime.ago('2026-11-07T11:55:00.000Z', now)).toBe('5 min ago');
      expect(RelativeTime.ago('2026-11-07T12:00:00.000Z', now)).toBe('just now');
      expect(RelativeTime.ago('2026-11-07T09:00:00.000Z', now)).toBe('3 h ago');
    });
  });

  describe('.minutesUntil', () => {
    it('rounds up and is at least one', () => {
      expect(RelativeTime.minutesUntil(now + 90000, now)).toBe(2);
      expect(RelativeTime.minutesUntil(now + 1000, now)).toBe(1);
      expect(RelativeTime.minutesUntil(now - 5000, now)).toBe(1);
    });
  });

  describe('.clock', () => {
    it('formats the local time as HH:MM', () => {
      const moment = new Date(2026, 10, 7, 9, 5).getTime();

      expect(RelativeTime.clock(moment)).toBe('09:05');
    });
  });
});
