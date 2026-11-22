import { FakeClock } from '../../core/tests/support/fake-clock.js';
import { FakeScheduler } from '../../core/tests/support/fake-scheduler.js';
import { FALLBACK_PAUSE_MS, IssueRateLimitPauses } from '../issue-rate-limit-pauses.js';
import { IssueReconcileQueue } from '../issue-reconcile-queue.js';

class RecordingQueue extends IssueReconcileQueue {
  readonly enqueued: number[] = [];

  enqueue(linkId: number): void {
    this.enqueued.push(linkId);
  }
}

const START = new Date('2026-06-01T12:00:00Z');
const at = (ms: number): Date => new Date(START.getTime() + ms);

describe('IssueRateLimitPauses', () => {
  let clock: FakeClock;
  let scheduler: FakeScheduler;
  let queue: RecordingQueue;
  let markedAt: Map<number, Date>;
  let markers: { markedAtFor: jest.Mock };
  let logger: { error: jest.Mock };
  let pauses: IssueRateLimitPauses;

  beforeEach(() => {
    clock = new FakeClock(START);
    scheduler = new FakeScheduler(clock);
    queue = new RecordingQueue();
    markedAt = new Map();
    markers = { markedAtFor: jest.fn(async () => markedAt) };
    logger = { error: jest.fn() };
    pauses = new IssueRateLimitPauses(clock, scheduler, queue, markers as never, logger as never);
  });

  // The timer's callback is asynchronous (it reads the marker ages); let it settle.
  const settle = () => new Promise((resolve) => setImmediate(resolve));

  describe('pause', () => {
    it('holds the reset time GitHub gave and answers it', () => {
      expect(pauses.pause(1, at(5_000))).toEqual(at(5_000));
      expect(pauses.isPaused(1)).toBe(true);
      expect(scheduler.pending).toEqual([at(5_000)]);
    });

    it('falls back to 60 seconds when GitHub gave no reset', () => {
      expect(FALLBACK_PAUSE_MS).toBe(60_000);
      expect(pauses.pause(1, null)).toEqual(at(60_000));
      expect(scheduler.pending).toEqual([at(60_000)]);
    });

    it('is keyed by integration: another integration keeps working', () => {
      pauses.pause(1, at(5_000));

      expect(pauses.isPaused(1)).toBe(true);
      expect(pauses.isPaused(2)).toBe(false);
    });

    it('stops being a pause once its reset has passed', () => {
      pauses.pause(1, at(5_000));
      clock.advance(5_000);

      expect(pauses.isPaused(1)).toBe(false);
    });

    it('re-arms the one timer on a later answer, never adding a second', () => {
      pauses.pause(1, at(5_000));
      pauses.pause(1, at(9_000));

      expect(scheduler.pending).toEqual([at(9_000)]);
      expect(pauses.isPaused(1)).toBe(true);
    });

    it('keeps the later reset when a concurrent answer would shorten a running pause', () => {
      pauses.pause(1, at(9_000));

      expect(pauses.pause(1, at(5_000))).toEqual(at(9_000));
      expect(scheduler.pending).toEqual([at(9_000)]);
    });

    it('carries the waiting links over to a pause that re-armed after the old one ended', () => {
      pauses.pause(1, at(5_000));
      pauses.wait(1, 10);
      clock.advance(6_000);
      pauses.pause(1, at(20_000));

      expect(scheduler.pending).toEqual([at(20_000)]);
      expect(pauses.untilFor([10]).get(10)).toEqual(at(20_000));
    });
  });

  describe('earliestPause', () => {
    it('answers the paused candidate whose reset comes first', () => {
      pauses.pause(1, at(9_000));
      pauses.pause(2, at(5_000));
      pauses.pause(3, at(7_000));

      expect(pauses.earliestPause([1, 2, 3])).toEqual({ integrationId: 2, resetAt: at(5_000) });
    });

    it('ignores candidates that are not paused, and answers null when none is', () => {
      pauses.pause(1, at(9_000));

      expect(pauses.earliestPause([2, 1])).toEqual({ integrationId: 1, resetAt: at(9_000) });
      expect(pauses.earliestPause([2, 3])).toBeNull();
      expect(pauses.earliestPause([])).toBeNull();
    });
  });

  describe('waiting sets', () => {
    it('does not add a link to an integration that is not paused', () => {
      expect(pauses.wait(1, 10)).toBeNull();
      expect(pauses.untilFor([10]).size).toBe(0);
    });

    it('answers when the wait ends, deduplicating the link', () => {
      pauses.pause(1, at(5_000));

      expect(pauses.wait(1, 10)).toEqual(at(5_000));
      expect(pauses.wait(1, 10)).toEqual(at(5_000));
    });

    it('untilFor lists only the waiting links, with the reset of their integration', () => {
      pauses.pause(1, at(5_000));
      pauses.pause(2, at(8_000));
      pauses.wait(1, 10);
      pauses.wait(2, 11);

      expect(pauses.untilFor([10, 11, 12])).toEqual(new Map([[10, at(5_000)], [11, at(8_000)]]));
      expect(pauses.untilFor([])).toEqual(new Map());
    });

    it('untilFor answers the earliest reset for a link that waits on two integrations', () => {
      pauses.pause(1, at(9_000));
      pauses.pause(2, at(5_000));
      pauses.wait(1, 10);
      pauses.wait(2, 10);

      expect(pauses.untilFor([10]).get(10)).toEqual(at(5_000));
    });

    it('untilFor stops listing a link once the pause ended', () => {
      pauses.pause(1, at(5_000));
      pauses.wait(1, 10);
      clock.advance(5_000);

      expect(pauses.untilFor([10]).size).toBe(0);
    });

    it('release takes the link out of every waiting set', () => {
      pauses.pause(1, at(5_000));
      pauses.pause(2, at(5_000));
      pauses.wait(1, 10);
      pauses.wait(2, 10);
      pauses.wait(2, 11);
      pauses.release(10);

      expect([...pauses.untilFor([10, 11]).keys()]).toEqual([11]);
    });
  });

  describe('resume', () => {
    it('enqueues nothing before the reset', async () => {
      pauses.pause(1, at(5_000));
      pauses.wait(1, 10);
      scheduler.advance(4_999);
      await settle();

      expect(queue.enqueued).toEqual([]);
      expect(pauses.isPaused(1)).toBe(true);
    });

    it('enqueues one reconcile per waiting link at the reset, then clears the pause and the set', async () => {
      pauses.pause(1, at(5_000));
      pauses.wait(1, 10);
      pauses.wait(1, 10);
      pauses.wait(1, 11);
      scheduler.advance(5_000);
      await settle();

      expect(queue.enqueued.sort()).toEqual([10, 11]);
      expect(pauses.isPaused(1)).toBe(false);
      expect(pauses.untilFor([10, 11]).size).toBe(0);
      expect(scheduler.pending).toEqual([]);

      scheduler.advance(60_000);
      await settle();
      expect(queue.enqueued).toHaveLength(2);
    });

    it('enqueues oldest marker first, links without a marker last', async () => {
      markedAt = new Map([[12, at(-3_000)], [10, at(-1_000)], [11, at(-2_000)]]);
      markers.markedAtFor.mockImplementation(async () => markedAt);
      pauses.pause(1, at(5_000));
      for (const linkId of [13, 10, 14, 11, 12]) pauses.wait(1, linkId);
      scheduler.advance(5_000);
      await settle();

      expect(markers.markedAtFor).toHaveBeenCalledWith([13, 10, 14, 11, 12]);
      expect(queue.enqueued).toEqual([12, 11, 10, 13, 14]);
    });

    it('enqueues in join order, and logs the error class only, when the marker ages cannot be read', async () => {
      markers.markedAtFor.mockRejectedValue(new TypeError('secret detail'));
      pauses.pause(1, at(5_000));
      pauses.wait(1, 12);
      pauses.wait(1, 10);
      scheduler.advance(5_000);
      await settle();

      expect(queue.enqueued).toEqual([12, 10]);
      expect(logger.error).toHaveBeenCalledWith('issues rate limit resume could not order links', {
        context: 'IssueRateLimitPauses',
        errorClass: 'TypeError',
      });
    });

    it('a later rate limit pauses again and arms a new timer', async () => {
      pauses.pause(1, at(5_000));
      pauses.wait(1, 10);
      scheduler.advance(5_000);
      await settle();
      pauses.pause(1, null);
      pauses.wait(1, 10);

      expect(pauses.isPaused(1)).toBe(true);
      expect(scheduler.pending).toEqual([at(65_000)]);

      scheduler.advance(60_000);
      await settle();
      expect(queue.enqueued).toEqual([10, 10]);
    });

    it('resumes each integration on its own timer', async () => {
      pauses.pause(1, at(5_000));
      pauses.pause(2, at(8_000));
      pauses.wait(1, 10);
      pauses.wait(2, 11);
      scheduler.advance(5_000);
      await settle();

      expect(queue.enqueued).toEqual([10]);
      expect(pauses.isPaused(2)).toBe(true);

      scheduler.advance(3_000);
      await settle();
      expect(queue.enqueued).toEqual([10, 11]);
    });
  });
});
