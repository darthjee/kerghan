import { FindOperator } from 'typeorm';
import type { IntegrationOauthState } from '../../entities/integration-oauth-state.entity.js';

type Where = Record<string, unknown>;

/** The columns every state row double has. */
export interface StateRow {
  id: number;
  uuid: string;
  createdAt: Date;
}

/**
 * Whether a column value satisfies a `where` value (plain equality, or the
 * `LessThanOrEqual`/`In` operators the state service uses).
 * @param {unknown} actual - The row's value.
 * @param {unknown} expected - The `where` value.
 * @returns {boolean} Whether it matches.
 */
function matchesValue(actual: unknown, expected: unknown): boolean {
  if (!(expected instanceof FindOperator)) {
    return actual === expected;
  }

  if (expected.type === 'lessThanOrEqual') {
    return (actual as Date).getTime() <= (expected.value as Date).getTime();
  }

  if (expected.type === 'in') {
    return (expected.value as unknown[]).includes(actual);
  }

  throw new Error(`unsupported operator ${expected.type}`);
}

function matches(row: StateRow, where: Where): boolean {
  return Object.entries(where).every(([key, value]) => matchesValue((row as never)[key], value));
}

/**
 * In-memory stand-in for a state table's `Repository`: auto-fills the id
 * and `createdAt`, enforces the unique `uuid`, and deletes synchronously
 * (so two parallel deletes of one row affect it once, like MySQL).
 * @returns {object} The repository double, exposing its `rows`.
 */
export function createInMemoryStateRepo<T extends StateRow>() {
  const rows: T[] = [];
  let nextId = 1;

  return {
    rows,
    create: (attributes: Partial<T>): T => ({ ...attributes }) as T,
    save: async (entity: T): Promise<T> => {
      if (rows.some((row) => row.uuid === entity.uuid)) {
        throw new Error('Duplicate entry');
      }

      const row = { ...entity, id: nextId, createdAt: entity.createdAt ?? new Date() };
      nextId += 1;
      rows.push(row);
      return { ...row };
    },
    findOne: async ({ where }: { where: Where }): Promise<T | null> => {
      const row = rows.find((candidate) => matches(candidate, where));
      return row ? { ...row } : null;
    },
    find: async ({ where }: { where: Where }): Promise<T[]> =>
      rows.filter((row) => matches(row, where)).sort((a, b) => b.id - a.id).map((row) => ({ ...row })),
    delete: async (where: Where): Promise<{ affected: number }> => {
      const before = rows.length;
      rows.splice(0, rows.length, ...rows.filter((row) => !matches(row, where)));
      return { affected: before - rows.length };
    },
  };
}

/**
 * In-memory stand-in for `Repository<IntegrationOauthState>`.
 * @returns {object} The repository double, exposing its `rows`.
 */
export function createInMemoryOauthStateRepo() {
  return createInMemoryStateRepo<IntegrationOauthState>();
}

/** The in-memory OAuth state repository type. */
export type InMemoryOauthStateRepo = ReturnType<typeof createInMemoryOauthStateRepo>;
