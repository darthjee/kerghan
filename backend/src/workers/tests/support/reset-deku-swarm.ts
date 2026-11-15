import { Job, JobFactory, JobRegistry, WorkersRegistry } from 'deku-swarm';

/**
 * Clears the three `deku-swarm` global singletons; call in `afterEach`.
 * @returns {void}
 */
export function resetDekuSwarm(): void {
  JobFactory.reset();
  JobRegistry.reset();
  WorkersRegistry.reset();
}

/** A promise resolved from outside, for specs to await instead of sleeping. */
export interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

/**
 * Builds a deferred promise.
 * @returns {Deferred} The promise and its resolver.
 */
export function done(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

/** Throwaway job: resolves `finished` once performed, or always fails. */
export class ThrowawayJob extends Job {
  static performed: string[] = [];
  static attempts = 0;
  readonly finished: Deferred;
  readonly shouldFail: boolean;
  readonly gate?: Deferred;

  constructor(params: Record<string, unknown> = {}) {
    super(params);
    this.finished = (params.finished as Deferred | undefined) ?? done();
    this.shouldFail = params.shouldFail === true;
    this.gate = params.gate as Deferred | undefined;
  }

  async perform(): Promise<void> {
    ThrowawayJob.attempts += 1;
    if (this.gate) await this.gate.promise;
    if (this.shouldFail) this._fail(new Error('secret failure detail'));
    ThrowawayJob.performed.push(this.id);
    this.finished.resolve();
  }
}
