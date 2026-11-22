import type { Job, JobLogger } from 'deku-swarm';
import type { JobClass, WorkersService } from '../../workers.service.js';

/** The `WorkersService` methods other modules use. */
export type WorkersSurface = Pick<WorkersService, 'register' | 'enqueue'>;

/** A job registration as recorded by `register`. */
export interface FakeRegistration {
  name: string;
  klass: JobClass;
  attributes: Record<string, unknown>;
}

/** An enqueue call as recorded by `enqueue`: the job name and the params it was given. */
export interface FakeEnqueue {
  id: string;
  name: string;
  params: Record<string, unknown>;
}

/** The logger every captured job is performed with; the calls are kept for assertions. */
export interface FakeJobLogger extends JobLogger {
  calls: Array<{ level: 'debug' | 'info' | 'warn' | 'error'; message: string }>;
}

/**
 * An in-memory stand-in for `WorkersService`, in the style of Repositories' `CapturingLauncher`:
 * `register` and `enqueue` are recorded (the call log is what the job-params allowlist assertion
 * reads), and nothing runs until a spec asks: `runNext()` / `runAll()` build each captured job
 * the way the real factory does (`new klass({ ...attributes, ...params })`) and perform it once.
 * There is no engine, no retry and no cooldown; a job that throws is kept in `errors`.
 */
export class FakeWorkersService implements WorkersSurface {
  readonly registrations: FakeRegistration[] = [];
  readonly enqueued: FakeEnqueue[] = [];
  readonly errors: unknown[] = [];
  readonly logger: FakeJobLogger = buildLogger();
  readonly #queue: FakeEnqueue[] = [];
  #counter = 0;

  register(name: string, klass: JobClass, attributes: Record<string, unknown> = {}): void {
    this.registrations.push({ name, klass, attributes });
  }

  enqueue(name: string, params: Record<string, unknown> = {}): string {
    this.#counter += 1;
    const entry: FakeEnqueue = { id: `fake-job-${this.#counter}`, name, params: { ...params } };

    this.enqueued.push(entry);
    this.#queue.push(entry);

    return entry.id;
  }

  /** The number of captured jobs still waiting to run. */
  get queued(): number {
    return this.#queue.length;
  }

  /** The params of every enqueue of a job name, in call order. */
  paramsOf(name: string): Array<Record<string, unknown>> {
    return this.enqueued.filter((entry) => entry.name === name).map((entry) => entry.params);
  }

  /** Builds the job of the oldest captured enqueue without performing it (the queue shrinks by one). */
  buildNext(): Job {
    const entry = this.#queue.shift();

    if (entry === undefined) throw new Error('FakeWorkersService: no captured job');
    const registration = [...this.registrations].reverse().find((candidate) => candidate.name === entry.name);

    if (registration === undefined) throw new Error(`FakeWorkersService: no job registered as ${entry.name}`);

    return new registration.klass({ ...registration.attributes, ...entry.params, id: entry.id });
  }

  /** Performs the oldest captured job once; a throw is kept in `errors`, not rethrown. */
  async runNext(): Promise<void> {
    try {
      await this.buildNext().perform(this.logger);
    } catch (error) {
      this.errors.push(error);
    }
  }

  /** Performs every captured job, including the ones enqueued while running, oldest first. */
  async runAll(): Promise<void> {
    while (this.#queue.length > 0) await this.runNext();
  }

  /** Forgets the captured queue and the call logs (registrations stay). */
  reset(): this {
    this.#queue.length = 0;
    this.enqueued.length = 0;
    this.errors.length = 0;
    this.logger.calls.length = 0;

    return this;
  }
}

function buildLogger(): FakeJobLogger {
  const calls: FakeJobLogger['calls'] = [];
  const at = (level: 'debug' | 'info' | 'warn' | 'error') => (message: string): void => {
    calls.push({ level, message });
  };

  return { calls, debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') };
}
