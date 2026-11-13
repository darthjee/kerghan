import { readdirSync, statSync } from 'fs';
import * as path from 'path';

/** The Repositories module's root (`src/repositories`). */
export const REPOSITORIES_ROOT = path.join(__dirname, '..', '..');

/**
 * Every `.ts` source of the Repositories module, `tests/` excluded: the
 * shared scanner of the static specs (`no-sql-now`, `module-boundaries`).
 * @param dir - The directory to scan (defaults to the module root).
 * @returns The absolute file paths.
 */
export function moduleSources(dir: string = REPOSITORIES_ROOT): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);

    if (statSync(full).isDirectory()) return entry === 'tests' ? [] : moduleSources(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}
