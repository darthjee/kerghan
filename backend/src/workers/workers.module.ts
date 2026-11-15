import { Module } from '@nestjs/common';
import { WorkersConfig } from './workers-config.js';
import { WorkersService } from './workers.service.js';
import { LoggingModule } from '../core/logging.module.js';

/**
 * Always-on module owning the in-process background worker pool. Exports
 * `WorkersService` so other modules can register and enqueue jobs.
 */
@Module({
  imports: [LoggingModule],
  providers: [WorkersConfig, WorkersService],
  exports: [WorkersService],
})
export class WorkersModule {}
