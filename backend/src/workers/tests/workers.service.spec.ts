import { Engine, JobFactory, JobRegistry, WorkersRegistry } from 'deku-swarm';
import { done, resetDekuSwarm, ThrowawayJob } from './support/reset-deku-swarm.js';
import type { LoggerService } from '../../core/logger.service.js';
import type { WorkersConfig } from '../workers-config.js';
import { WorkersService } from '../workers.service.js';

function buildConfig(overrides: Partial<WorkersConfig> = {}): WorkersConfig {
  return {
    poolSize: 2,
    cooldownMs: 1,
    maxRetries: 2,
    sleepMs: 1,
    drainTimeoutMs: 50,
    drainPollMs: 5,
    ...overrides,
  } as WorkersConfig;
}

function fakeLogger() {
  return { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

function build(overrides: Partial<WorkersConfig> = {}) {
  const logger = fakeLogger();
  const service = new WorkersService(buildConfig(overrides), logger as unknown as LoggerService);

  return { service, logger };
}

describe('WorkersService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    resetDekuSwarm();
    ThrowawayJob.performed = [];
    ThrowawayJob.attempts = 0;
  });

  it('builds the registries with the configured values', () => {
    const { service } = build({ poolSize: 4 });
    const jobSpy = jest.spyOn(JobRegistry, 'ensureBuild');
    const workersSpy = jest.spyOn(WorkersRegistry, 'ensureBuild');

    service.onModuleInit();

    expect(jobSpy).toHaveBeenCalledWith({ cooldown: 1, maxRetries: 2 });
    expect(workersSpy).toHaveBeenCalledWith(expect.objectContaining({ quantity: 4 }));
    expect(WorkersRegistry.stats()).toEqual({ idle: 4, busy: 0 });
  });

  it('does not throw when initialised twice', () => {
    const { service } = build();

    service.onModuleInit();

    expect(() => service.onModuleInit()).not.toThrow();
  });

  it('starts a keepAlive engine and stops it on shutdown', async () => {
    const { service } = build({ sleepMs: 1 });
    const start = jest.spyOn(Engine.prototype, 'start');
    const stop = jest.spyOn(Engine.prototype, 'stop');

    service.onModuleInit();
    service.onApplicationBootstrap();
    await service.onApplicationShutdown();

    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('waits for a busy worker and finishes as soon as it is idle', async () => {
    const { service, logger } = build({ drainTimeoutMs: 5000 });
    service.onModuleInit();
    service.onApplicationBootstrap();
    const gate = done();
    service.register('job', ThrowawayJob);
    service.enqueue('job', { gate });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(WorkersRegistry.hasBusyWorker()).toBe(true);

    const shutdown = service.onApplicationShutdown();
    gate.resolve();
    await shutdown;

    expect(WorkersRegistry.hasBusyWorker()).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('gives up after the drain timeout and warns', async () => {
    const { service, logger } = build();
    service.onModuleInit();
    service.onApplicationBootstrap();
    const gate = done();
    service.register('job', ThrowawayJob);
    service.enqueue('job', { gate });
    await new Promise((resolve) => setTimeout(resolve, 20));

    await service.onApplicationShutdown();

    expect(logger.warn).toHaveBeenCalledWith('workers drain timed out', { context: 'WorkersService' });
    gate.resolve();
  });

  it('logs an engine crash with the error class only and still shuts down', async () => {
    const { service, logger } = build();
    const start = jest.spyOn(Engine.prototype, 'start').mockRejectedValue(new TypeError('secret detail'));

    service.onModuleInit();
    service.onApplicationBootstrap();
    await service.onApplicationShutdown();

    expect(start).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('workers engine crashed', {
      context: 'WorkersService',
      errorClass: 'TypeError',
    });
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('secret detail');
  });

  it('reports a non-Error crash by its type', async () => {
    const { service, logger } = build();
    jest.spyOn(Engine.prototype, 'start').mockRejectedValue('boom');

    service.onModuleInit();
    service.onApplicationBootstrap();
    await service.onApplicationShutdown();

    expect(logger.error).toHaveBeenCalledWith('workers engine crashed', {
      context: 'WorkersService',
      errorClass: 'string',
    });
  });

  it('runs a registered job end to end', async () => {
    const { service } = build({ sleepMs: 1 });
    service.onModuleInit();
    service.onApplicationBootstrap();
    const finished = done();
    service.register('job', ThrowawayJob);

    const id = service.enqueue('job', { finished });
    await finished.promise;

    expect(ThrowawayJob.performed).toEqual([id]);
    expect(JobFactory.get('job')).toBeDefined();
    await service.onApplicationShutdown();
  });

  it('retries a failing job until it is dead and logs through the Core logger', async () => {
    const { service, logger } = build({ sleepMs: 1, maxRetries: 2 });
    service.onModuleInit();
    service.onApplicationBootstrap();
    service.register('job', ThrowawayJob);

    const id = service.enqueue('job', { shouldFail: true });
    while (JobRegistry.stats().dead === 0) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    await service.onApplicationShutdown();

    expect(ThrowawayJob.attempts).toBe(3);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(`#${id}`),
      expect.objectContaining({ context: 'Workers', jobId: id }),
    );
  });
});
