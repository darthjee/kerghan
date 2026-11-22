declare module 'deku-swarm' {
  /** Attributes accepted by every Job constructor. */
  export interface JobParams {
    id?: string;
    maxRetries?: number;
    cooldown?: number;
    [key: string]: unknown;
  }

  /** Logger handed to `Job#perform` by its worker. */
  export interface JobLogger {
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
  }

  /** Abstract base class for units of work. */
  export class Job {
    id: string;
    constructor(params?: JobParams);
    /**
     * The retry limit of this job (deku-swarm 1.12.0: the `maxRetries` param, else 3). A subclass may
     * override the getter to give its own limit.
     */
    get maxRetries(): number;
    /**
     * The cooldown in milliseconds applied on failure (deku-swarm 1.12.0: the `cooldown` param, else
     * `undefined`, which falls back to the registry's). A subclass may override the getter.
     */
    get cooldown(): number | undefined;
    perform(logger?: JobLogger): Promise<unknown>;
    protected _fail(error: unknown): never;
  }

  /** Options accepted by the JobFactory constructor and static build. */
  export interface JobFactoryOptions {
    klass?: new (params?: JobParams) => Job;
    attributes?: Record<string, unknown>;
  }

  /** Builds and registers Job factories by name. */
  export class JobFactory {
    constructor(options?: JobFactoryOptions);
    build(params?: Record<string, unknown>): Job;
    static build(name: string, options?: JobFactoryOptions): JobFactory;
    static registry(name: string, factory: JobFactory): void;
    static get(name: string): JobFactory | undefined;
    static reset(): void;
  }

  /** Options for the singleton job registry. */
  export interface JobRegistryOptions {
    cooldown?: number;
    maxRetries?: number;
  }

  /** Static singleton facade over the job queues. */
  export class JobRegistry {
    static build(options?: JobRegistryOptions): unknown;
    static ensureBuild(options?: JobRegistryOptions): unknown;
    static reset(): void;
    static clearQueues(): void;
    static enqueue(factoryKey: string, params?: Record<string, unknown>): Job;
    static hasJob(): boolean;
    static hasReadyJob(): boolean;
    static stats(): Record<string, number>;
  }

  /** Worker that performs jobs. */
  export class Worker {
    id: string;
  }

  /** Options for the WorkerFactory constructor. */
  export interface WorkerFactoryOptions {
    klass?: new (params: Record<string, unknown>) => Worker;
    jobRegistry?: unknown;
    workersRegistry?: unknown;
    loggerFactory?: (ids: { workerId: string; jobId: string }) => JobLogger;
  }

  /** Builds Worker instances. */
  export class WorkerFactory {
    constructor(options?: WorkerFactoryOptions);
    build(): Worker;
  }

  /** Options for the singleton workers registry. */
  export interface WorkersRegistryOptions {
    quantity?: number;
    factory?: WorkerFactory;
    jobRegistry?: unknown;
    workersRegistry?: unknown;
  }

  /** Static singleton facade over the worker pool. */
  export class WorkersRegistry {
    static build(options?: WorkersRegistryOptions): unknown;
    static ensureBuild(options?: WorkersRegistryOptions): unknown;
    static reset(): void;
    static initWorkers(): void;
    static hasBusyWorker(): boolean;
    static hasIdleWorker(): boolean;
    static stats(): { idle: number; busy: number };
  }

  /** Options for the Engine constructor. */
  export interface EngineOptions {
    sleepMs?: number;
    keepAlive?: boolean;
    idleTimeoutMs?: number;
    onIdleTimeout?: () => void;
  }

  /** Loop that allocates ready jobs to idle workers. */
  export class Engine {
    constructor(options?: EngineOptions);
    start(): Promise<void>;
    stop(): void;
    pause(): void;
    resume(): void;
  }
}
