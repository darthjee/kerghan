import type { JobLogger } from 'deku-swarm';
import type { LoggerService } from '../core/logger.service.js';

/**
 * Builds the `loggerFactory` handed to `deku-swarm`'s `WorkerFactory`: for each
 * job a worker performs, a logger that delegates to `LoggerService` with safe
 * fields only (`context`, `workerId`, `jobId`) — never job attributes.
 * @param {LoggerService} logger - The Core logger.
 * @returns {(ids: { workerId: string; jobId: string }) => JobLogger} The factory.
 */
export function buildWorkersLoggerFactory(
  logger: LoggerService,
): (ids: { workerId: string; jobId: string }) => JobLogger {
  return ({ workerId, jobId }) => {
    const fields = { context: 'Workers', workerId, jobId };

    return {
      debug: (message: string) => logger.debug(message, fields),
      info: (message: string) => logger.info(message, fields),
      warn: (message: string) => logger.warn(message, fields),
      error: (message: string) => logger.error(message, fields),
    };
  };
}
