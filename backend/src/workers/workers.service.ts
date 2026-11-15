import { Injectable, type OnApplicationBootstrap, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import {
  Engine,
  type Job,
  JobFactory,
  type JobParams,
  JobRegistry,
  WorkerFactory,
  WorkersRegistry,
} from 'deku-swarm';
import { buildWorkersLoggerFactory } from './workers-logger.js';
import { WorkersConfig } from './workers-config.js';
import { LoggerService } from '../core/logger.service.js';

/** A job class that can be registered under a name. */
export type JobClass = new (params?: JobParams) => Job;

/**
 * In-process background worker pool (`deku-swarm`). Other modules register a
 * job class under a name and enqueue by name; they never touch the library's
 * statics. Queues are in-memory: a restart loses pending jobs.
 *
 * Lifecycle: registries are built in `onModuleInit`, the engine
 * (`keepAlive`) starts in `onApplicationBootstrap`, and on shutdown the engine
 * is stopped and busy workers get a bounded drain.
 */
@Injectable()
export class WorkersService implements OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown {
  #engine?: Engine;
  #run?: Promise<void>;

  /**
   * @param {WorkersConfig} config - The pool, retry and drain values.
   * @param {LoggerService} logger - The Core logger.
   */
  constructor(
    private readonly config: WorkersConfig,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Builds the job and worker registries and initializes the pool.
   * @returns {void}
   */
  onModuleInit(): void {
    JobRegistry.ensureBuild({ cooldown: this.config.cooldownMs, maxRetries: this.config.maxRetries });
    WorkersRegistry.ensureBuild({
      quantity: this.config.poolSize,
      factory: new WorkerFactory({
        jobRegistry: JobRegistry,
        workersRegistry: WorkersRegistry,
        loggerFactory: buildWorkersLoggerFactory(this.logger),
      }),
    });
    WorkersRegistry.initWorkers();
  }

  /**
   * Starts the engine without awaiting it. A crash is logged (error class
   * only) and the engine is never restarted.
   * @returns {void}
   */
  onApplicationBootstrap(): void {
    this.#engine = new Engine({ keepAlive: true, sleepMs: this.config.sleepMs });
    this.#run = this.#engine.start().catch((error: unknown) => {
      this.logger.error('workers engine crashed', {
        context: 'WorkersService',
        errorClass: error instanceof Error ? error.constructor.name : typeof error,
      });
    });
  }

  /**
   * Stops the engine, then waits (bounded) for busy workers to finish.
   * @returns {Promise<void>} Resolves once drained or the timeout passes.
   */
  async onApplicationShutdown(): Promise<void> {
    this.#engine?.stop();
    await this.#run;
    await this.#drain();
  }

  /**
   * Registers a job class under a name so it can be enqueued by that name.
   * @param {string} name - The job name.
   * @param {JobClass} klass - The job class.
   * @param {Record<string, unknown>} attributes - Injected into every built job
   *   (e.g. services). Jobs must be enqueued with ids, never secrets.
   * @returns {void}
   */
  register(name: string, klass: JobClass, attributes: Record<string, unknown> = {}): void {
    JobFactory.build(name, { klass, attributes });
  }

  /**
   * Enqueues a job built by the factory registered under `name`.
   * @param {string} name - The registered job name.
   * @param {Record<string, unknown>} params - Build params (ids only, never secrets).
   * @returns {string} The job id.
   */
  enqueue(name: string, params: Record<string, unknown> = {}): string {
    return JobRegistry.enqueue(name, params).id;
  }

  /**
   * Polls until no worker is busy or the drain timeout passes; on timeout logs
   * a warning without job data.
   * @returns {Promise<void>} Resolves when drained or timed out.
   */
  async #drain(): Promise<void> {
    const deadline = Date.now() + this.config.drainTimeoutMs;

    while (WorkersRegistry.hasBusyWorker()) {
      if (Date.now() >= deadline) {
        this.logger.warn('workers drain timed out', { context: 'WorkersService' });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, this.config.drainPollMs));
    }
  }
}
