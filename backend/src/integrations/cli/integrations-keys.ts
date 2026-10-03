import 'reflect-metadata';
import { Console } from 'node:console';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module.js';
import {
  formatKeyStatus,
  formatReencryptSummary,
  IntegrationsKeyRotationService,
  reencryptExitCode,
} from '../integrations-key-rotation.service.js';

// Printed (to stderr) for a missing or unknown command.
const USAGE = 'usage: integrations-keys <status|reencrypt>\n';

// Exit code for a usage error.
const USAGE_EXIT_CODE = 2;

// Route all console logging (LoggerService writes `info`/`debug` through
// `console`) to stderr, so stdout carries only the command's report.
globalThis.console = new Console({ stdout: process.stderr, stderr: process.stderr });

/**
 * Operator-only `KERGHAN_INTEGRATIONS_KEY` rotation CLI. Boots the same
 * `AppModule` as the server as an application context (so key validation
 * and DB config are identical), runs one command and prints its result to
 * stdout: `status` prints `<keyId> <current|previous|unknown> <count>`
 * lines (exit 0); `reencrypt` prints
 * `reencrypted=<n> skipped_undecryptable=<n> skipped_changed=<n>` (exit 1
 * when any row was undecryptable). Never prints a key, ciphertext or secret.
 * @param {string | undefined} command - `status` or `reencrypt`.
 * @returns {Promise<number>} The process exit code.
 */
async function run(command: string | undefined): Promise<number> {
  if (command !== 'status' && command !== 'reencrypt') {
    process.stderr.write(USAGE);
    return USAGE_EXIT_CODE;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  try {
    const rotation = app.get(IntegrationsKeyRotationService);

    if (command === 'status') {
      process.stdout.write(formatKeyStatus(await rotation.status()));
      return 0;
    }

    const result = await rotation.reencrypt();
    process.stdout.write(formatReencryptSummary(result));
    return reencryptExitCode(result);
  } finally {
    await app.close();
  }
}

run(process.argv[2])
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    // Message only: a driver error object may carry query parameters (ciphertexts).
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
