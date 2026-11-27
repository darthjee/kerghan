import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { LoggerService } from '../../core/logger.service.js';
import { FakeWorkersService } from '../../workers/tests/support/fake-workers.service.js';
import { WorkersService } from '../../workers/workers.service.js';
import { HealthService } from '../health.service.js';

const releaseVersion = (
  JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf8')) as { version: string }
).version;

describe('HealthService', () => {
  let directory: string;
  let query: jest.Mock;
  let logger: { error: jest.Mock; warn: jest.Mock };
  let workers: FakeWorkersService;
  let service: HealthService;

  function writePackageJson(content: string): string {
    const path = join(directory, 'package.json');

    writeFileSync(path, content);

    return path;
  }

  function build(packageJsonPath?: string): HealthService {
    return new HealthService(
      { query } as unknown as DataSource,
      logger as unknown as LoggerService,
      workers as unknown as WorkersService,
      packageJsonPath,
    );
  }

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'kerghan-health-'));
    query = jest.fn().mockResolvedValue([{ 1: 1 }]);
    logger = { error: jest.fn(), warn: jest.fn() };
    workers = new FakeWorkersService();
    service = build(writePackageJson('{"version":"9.8.7"}'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  describe('liveness', () => {
    it('carries the marker, status ok and the version of the read file', () => {
      expect(service.liveness()).toEqual({ app: 'kerghan', status: 'ok', version: '9.8.7' });
    });

    it('touches no dependency', () => {
      const isRunning = jest.spyOn(workers, 'isRunning');

      service.liveness();

      expect(query).not.toHaveBeenCalled();
      expect(isRunning).not.toHaveBeenCalled();
    });
  });

  describe('checkReadiness', () => {
    it.each([
      { database: 'up', workers: 'up', status: 'ok' },
      { database: 'up', workers: 'down', status: 'degraded' },
      { database: 'down', workers: 'up', status: 'error' },
      { database: 'down', workers: 'down', status: 'error' },
    ])('reports $status with the database $database and the workers $workers', async (state) => {
      if (state.database === 'down') query.mockRejectedValue(new Error('unreachable'));
      workers.running = state.workers === 'up';

      await expect(service.checkReadiness()).resolves.toEqual({
        app: 'kerghan',
        status: state.status,
        version: '9.8.7',
        checks: { database: state.database, workers: state.workers },
      });
    });

    it('probes the database with SELECT 1', async () => {
      await service.checkReadiness();

      expect(query).toHaveBeenCalledWith('SELECT 1');
    });

    it('logs nothing when every check is up', async () => {
      await service.checkReadiness();

      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('when the database query fails', () => {
    const secret = 'connect ECONNREFUSED 10.0.0.5:3306';

    beforeEach(() => {
      query.mockRejectedValue(new Error(secret));
    });

    it('logs the failure reason once', async () => {
      await service.checkReadiness();

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('readiness check failed', {
        context: 'HealthService',
        check: 'database',
        reason: secret,
      });
    });

    it('never exposes the error message to the caller', async () => {
      const result = await service.checkReadiness();

      expect(result.checks.database).toBe('down');
      expect(JSON.stringify(result)).not.toContain(secret);
    });
  });

  describe('when the database query rejects with a non-Error value', () => {
    it('reports the database down and logs the stringified reason', async () => {
      query.mockRejectedValue('boom');

      const result = await service.checkReadiness();

      expect(result.checks.database).toBe('down');
      expect(logger.error).toHaveBeenCalledWith(
        'readiness check failed',
        expect.objectContaining({ reason: 'boom' }),
      );
    });
  });

  describe('when the workers are down', () => {
    beforeEach(() => {
      workers.running = false;
    });

    it('warns once while they stay down', async () => {
      await service.checkReadiness();
      await service.checkReadiness();

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith('readiness check failed', {
        context: 'HealthService',
        check: 'workers',
      });
    });

    it('warns again on the next transition to down', async () => {
      await service.checkReadiness();
      workers.running = true;
      await service.checkReadiness();
      workers.running = false;
      await service.checkReadiness();

      expect(logger.warn).toHaveBeenCalledTimes(2);
    });
  });

  describe('version', () => {
    it('is read from the backend package.json by default', () => {
      expect(build().liveness().version).toBe(releaseVersion);
    });

    it('is read once, at construction', async () => {
      writePackageJson('{"version":"1.0.0"}');

      expect(service.liveness().version).toBe('9.8.7');
      await expect(service.checkReadiness()).resolves.toHaveProperty('version', '9.8.7');
    });

    it.each([
      { case: 'the file is missing', content: undefined },
      { case: 'the file is not JSON', content: 'not json' },
      { case: 'the file holds null', content: 'null' },
      { case: 'there is no version', content: '{}' },
      { case: 'the version is empty', content: '{"version":""}' },
      { case: 'the version is not a string', content: '{"version":3}' },
    ])('is omitted, with one warning, when $case', async ({ content }) => {
      const path = content === undefined ? join(directory, 'absent.json') : writePackageJson(content);
      const broken = build(path);

      const liveness = broken.liveness();
      const readiness = await broken.checkReadiness();
      broken.liveness();

      expect(liveness).not.toHaveProperty('version');
      expect(liveness).toEqual({ app: 'kerghan', status: 'ok' });
      expect(readiness).not.toHaveProperty('version');
      expect(readiness.status).toBe('ok');
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        'release version unavailable',
        expect.objectContaining({ context: 'HealthService' }),
      );
      expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(directory);
    });

    it('logs only the error class of a parse failure', () => {
      build(writePackageJson('not json'));

      expect(logger.warn).toHaveBeenCalledWith('release version unavailable', {
        context: 'HealthService',
        errorClass: 'SyntaxError',
      });
    });
  });

  describe('dependency injection', () => {
    it('is built by Nest without a provider for the package.json path', async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          HealthService,
          { provide: DataSource, useValue: { query } },
          { provide: LoggerService, useValue: logger },
          { provide: WorkersService, useValue: workers },
        ],
      }).compile();

      expect(moduleRef.get(HealthService).liveness().version).toBe(releaseVersion);
      await moduleRef.close();
    });
  });
});
