/**
 * Jest `globalTeardown` for the DB-backed tier. `globalSetup` already closes
 * its connection and each test file closes its own (see `truncate-each.ts`),
 * so there is nothing left to release.
 *
 * @returns resolves immediately.
 */
export default async function globalTeardown(): Promise<void> {
  // Intentionally empty.
}
