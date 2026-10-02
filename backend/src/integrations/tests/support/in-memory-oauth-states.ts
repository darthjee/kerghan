import { FindOperator } from 'typeorm';
import type { IntegrationOauthState } from '../../entities/integration-oauth-state.entity.js';

type Where = Partial<Record<keyof IntegrationOauthState, unknown>>;

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

function matches(row: IntegrationOauthState, where: Where): boolean {
  return Object.entries(where).every(([key, value]) => matchesValue((row as never)[key], value));
}

/**
 * In-memory stand-in for `Repository<IntegrationOauthState>`: auto-fills the
 * id and `createdAt`, enforces the unique `uuid`, and deletes synchronously
 * (so two parallel deletes of one row affect it once, like MySQL).
 * @returns {object} The repository double, exposing its `rows`.
 */
export function createInMemoryOauthStateRepo() {
  const rows: IntegrationOauthState[] = [];
  let nextId = 1;

  return {
    rows,
    create: (attributes: Partial<IntegrationOauthState>): IntegrationOauthState => ({ ...attributes }) as IntegrationOauthState,
    save: async (entity: IntegrationOauthState): Promise<IntegrationOauthState> => {
      if (rows.some((row) => row.uuid === entity.uuid)) {
        throw new Error('Duplicate entry');
      }

      const row = { ...entity, id: nextId, createdAt: entity.createdAt ?? new Date() };
      nextId += 1;
      rows.push(row);
      return { ...row };
    },
    findOne: async ({ where }: { where: Where }): Promise<IntegrationOauthState | null> => {
      const row = rows.find((candidate) => matches(candidate, where));
      return row ? { ...row } : null;
    },
    find: async ({ where }: { where: Where }): Promise<IntegrationOauthState[]> =>
      rows.filter((row) => matches(row, where)).sort((a, b) => b.id - a.id).map((row) => ({ ...row })),
    delete: async (where: Where): Promise<{ affected: number }> => {
      const before = rows.length;
      rows.splice(0, rows.length, ...rows.filter((row) => !matches(row, where)));
      return { affected: before - rows.length };
    },
  };
}

/** The in-memory OAuth state repository type. */
export type InMemoryOauthStateRepo = ReturnType<typeof createInMemoryOauthStateRepo>;
