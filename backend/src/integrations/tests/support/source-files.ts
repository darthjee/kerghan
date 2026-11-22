import { readdirSync, statSync } from 'fs';
import * as path from 'path';

/** The `backend/src` directory. */
export const SRC_ROOT = path.join(__dirname, '..', '..', '..');

/** The Integrations module's root (`src/integrations`). */
export const INTEGRATIONS_ROOT = path.join(SRC_ROOT, 'integrations');

/**
 * Every non-test `.ts` source under a directory: `tests/` folders and spec or test-support
 * files are skipped. The shared scanner of the static Integrations specs.
 * @param {string} dir - The directory to scan.
 * @returns {string[]} The absolute file paths.
 */
export function sourcesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);

    if (statSync(full).isDirectory()) {
      return entry === 'tests' ? [] : sourcesUnder(full);
    }

    return full.endsWith('.ts') && !/(?:spec|test-support)\.ts$/.test(full) ? [full] : [];
  });
}
