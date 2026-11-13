import { DetachedSyncLauncher } from '../sync-launcher.js';
import { CapturingLauncher } from './support/capturing-launcher.js';

describe('DetachedSyncLauncher', () => {
  it('starts the task without awaiting it', async () => {
    const logger = { error: jest.fn() };
    const launcher = new DetachedSyncLauncher(logger as never);
    let resolve!: () => void;
    const started = new Promise<void>((done) => { resolve = done; });
    const task = jest.fn(() => { resolve(); return new Promise<void>(() => undefined); });

    expect(launcher.launch(task)).toBeUndefined();
    await started;
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('catches and logs (error class only) what the task throws', async () => {
    const logger = { error: jest.fn() };
    const launcher = new DetachedSyncLauncher(logger as never);
    let resolve!: () => void;
    const logged = new Promise<void>((done) => { resolve = done; });

    logger.error.mockImplementation(() => resolve());
    launcher.launch(async () => { throw new TypeError('secret CANARY'); });
    await logged;

    expect(logger.error).toHaveBeenCalledWith('repositories sync crashed', expect.objectContaining({ errorClass: 'TypeError' }));
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('CANARY');
  });

  it('logs a non-error throw by its type', async () => {
    const logger = { error: jest.fn() };
    const launcher = new DetachedSyncLauncher(logger as never);
    let resolve!: () => void;
    const logged = new Promise<void>((done) => { resolve = done; });

    logger.error.mockImplementation(() => resolve());
    launcher.launch(() => Promise.reject('nope'));
    await logged;

    expect(logger.error).toHaveBeenCalledWith('repositories sync crashed', expect.objectContaining({ errorClass: 'string' }));
  });
});

describe('CapturingLauncher', () => {
  it('captures tasks and runs them all, including ones queued while running', async () => {
    const launcher = new CapturingLauncher();
    const order: string[] = [];

    launcher.launch(async () => {
      order.push('a');
      launcher.launch(async () => { order.push('b'); });
    });
    expect(order).toEqual([]);

    await launcher.runAll();

    expect(order).toEqual(['a', 'b']);
    expect(launcher.launched).toBe(2);
  });

  it('runs one task at a time and records errors', async () => {
    const launcher = new CapturingLauncher();

    launcher.launch(async () => { throw new Error('boom'); });
    await launcher.runNext();

    expect(launcher.errors).toHaveLength(1);
    expect(() => launcher.startNext()).toThrow(/no captured task/);
    await expect(launcher.runNext()).rejects.toThrow(/no captured task/);
  });
});
