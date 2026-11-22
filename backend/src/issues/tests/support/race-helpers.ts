import type { DataSource } from 'typeorm';

/**
 * Waits (on timers; real MySQL and HTTP I/O sit in between) until `condition` holds.
 * @param condition - The condition, polled every 5 ms.
 * @param what - What is awaited, for the failure message.
 * @returns Resolves once the condition holds.
 */
export async function until(condition: () => boolean | Promise<boolean>, what: string): Promise<void> {
  for (let turn = 0; turn < 2_000; turn += 1) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  throw new Error(`until: ${what} never held`);
}

/**
 * Whether a statement on `table` is blocked on a row lock (`FOR UPDATE`).
 * @param ds - Any data source on the same database.
 * @param table - The table name.
 * @returns `true` while such a statement is waiting.
 */
export async function lockWaiterOn(ds: DataSource, table: string): Promise<boolean> {
  const rows: unknown[] = await ds.query(
    `SELECT 1 FROM information_schema.processlist WHERE info LIKE '%${table}%FOR UPDATE%' AND info NOT LIKE '%processlist%'`,
  );

  return rows.length > 0;
}
