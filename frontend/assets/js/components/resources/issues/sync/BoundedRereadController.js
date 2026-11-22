/** Milliseconds after the trigger's response at which each re-read runs (2 s, 5 s, 10 s). */
const READ_OFFSETS = [2000, 5000, 10000];

/**
 * Tell whether an issue deserves the bounded re-read: it is linked and not `gone`.
 *
 * @param {{link: (object|null|undefined)}} issue - The issue.
 * @returns {boolean} `true` for a linked, non-`gone` issue.
 */
export function shouldReread(issue) {
  const link = issue?.link;

  return Boolean(link) && link.state !== 'gone';
}

/**
 * Parse a timestamp to milliseconds.
 *
 * @param {string|null|undefined} value - An ISO timestamp.
 * @returns {number} The milliseconds, `-Infinity` when absent.
 */
function time(value) {
  const parsed = value ? Date.parse(value) : Number.NaN;

  return Number.isNaN(parsed) ? -Infinity : parsed;
}

/**
 * Tell whether a re-read shows the sync moved on from the trigger's response.
 *
 * @param {{states: string[], lastSyncedAt: string|null}} before - The link at the trigger.
 * @param {{states: string[], lastSyncedAt: string|null}} after - The link just read.
 * @returns {boolean} `true` for a later `lastSyncedAt` or different `states`.
 */
function hasChanged(before, after) {
  if (time(after.lastSyncedAt) > time(before.lastSyncedAt)) {
    return true;
  }

  const beforeStates = before.states ?? [];
  const afterStates = after.states ?? [];

  return beforeStates.length !== afterStates.length
    || beforeStates.some((state, index) => state !== afterStates[index]);
}

/**
 * Re-reads an issue at 2 s, 5 s and 10 s after a trigger (refresh, retry sync, save), stopping
 * early when the sync moved on. Never a background poll: it stops quietly after the third read.
 */
export default class BoundedRereadController {
  /**
   * Create a controller.
   *
   * @param {object} options - The collaborators.
   * @param {Function} options.read - Reads the issue; returns a promise of it.
   * @param {Function} options.onIssue - Called with every issue read.
   * @param {Function} [options.onDone] - Called once when the re-read stops.
   * @param {Function} [options.onNotFound] - Called when a read answers `404`.
   * @param {{set: Function, clear: Function}} [options.timers] - Injected timers.
   */
  constructor({ read, onIssue, onDone, onNotFound, timers }) {
    this.read = read;
    this.onIssue = onIssue;
    this.onDone = onDone;
    this.onNotFound = onNotFound;
    this.timers = timers ?? {
      set: (callback, ms) => setTimeout(callback, ms),
      clear: (id) => clearTimeout(id),
    };
    this.handles = [];
    this.running = false;
  }

  /**
   * Start the re-reads after a trigger's response.
   *
   * @description Does nothing for an issue that is not linked or is `gone`, and restarts a
   * running re-read.
   * @param {object} issue - The issue the trigger answered with.
   * @returns {boolean} `true` when the re-reads were scheduled.
   */
  start(issue) {
    this.dispose();

    if (!shouldReread(issue)) {
      return false;
    }

    this.running = true;
    this.trigger = issue.link;
    this.pending = READ_OFFSETS.length;
    this.handles = READ_OFFSETS.map((offset) => this.timers.set(() => this.tick(), offset));

    return true;
  }

  /**
   * Run one scheduled read.
   *
   * @returns {Promise<void>} Resolves once the read was handled.
   */
  async tick() {
    const generation = this.handles;

    try {
      const issue = await this.read();

      if (this.handles === generation && this.running) {
        this.handleIssue(issue);
      }
    } catch (error) {
      this.handleError(generation, error);
    }

    if (this.handles === generation && this.running) {
      this.pending -= 1;
      if (this.pending === 0) {
        this.finish();
      }
    }
  }

  /**
   * Hand a read issue to the caller and stop when the sync moved on.
   *
   * @param {object} issue - The issue read.
   * @returns {void} Nothing.
   */
  handleIssue(issue) {
    this.onIssue(issue);

    if (!shouldReread(issue) || hasChanged(this.trigger, issue.link)) {
      this.finish();
    }
  }

  /**
   * Handle a failed read: a `404` is reported, anything else is ignored.
   *
   * @param {Array} generation - The handles of the run that started the read.
   * @param {{status: (number|undefined)}} error - The thrown error.
   * @returns {void} Nothing.
   */
  handleError(generation, error) {
    if (this.handles !== generation || !this.running || error?.status !== 404) {
      return;
    }

    this.finish(true);
  }

  /**
   * Stop the re-reads and report it.
   *
   * @param {boolean} [notFound] - Whether the stop is a `404`.
   * @returns {void} Nothing.
   */
  finish(notFound = false) {
    this.dispose();

    if (notFound) {
      this.onNotFound?.();
    }

    this.onDone?.();
  }

  /**
   * Clear every pending timer and ignore reads still in flight.
   *
   * @returns {void} Nothing.
   */
  dispose() {
    this.handles.forEach((handle) => this.timers.clear(handle));
    this.handles = [];
    this.running = false;
  }
}
