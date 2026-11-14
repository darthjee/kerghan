import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { IntegrationRef } from '../integrations/integrations-github.public.js';
import { OK_SOURCE_STATUSES } from './entities/repository-source-status.entity.js';
import { effectiveIntegrationId } from './row-status.js';
import type { RowStatus } from './row-status.js';
import { HANDLE_SOURCE_KEY, integrationSourceKey } from './source-key.js';
import type { IntegrationSummary, ListedRepository, ListInput, SourceRef } from './types/repositories-api.types.js';

/** The user's current sources: every integration (oldest first) and the stored handle. */
export interface ListingScope {
  integrations: IntegrationRef[];
  handle: string | null;
}

/** A listed row with its internal id and current source keys (never leaves the module). */
export interface ListingRow {
  id: number;
  sourceKeys: string[];
  repository: ListedRepository;
}

/** A filter on the row itself (by internal id or `github_id`). */
export type RowSelector = { id: number } | { githubId: number };

interface RawRow {
  id: number;
  github_id: string | number;
  owner: string;
  name: string;
  private: number | boolean;
  added_at: Date | null;
  integration_id: number | null;
  last_seen_at: Date;
  status: RowStatus;
}

interface Sql {
  sql: string;
  params: unknown[];
}

// No real source key or integration id is empty / 0, so these keep `IN (?)` valid when a list is empty.
const NO_KEY = '';
const NO_ID = 0;

// The SQL twin of `deriveRowStatus` (`row-status.ts`, pinned by its unit table),
// over the current sources only: the filter must apply before pagination.
const STATUS_SQL = 'CASE'
  + ' WHEN r.added_at IS NULL THEN \'not_added\''
  + ' WHEN NOT EXISTS (SELECT 1 FROM repositories_sources s WHERE s.user_id = r.user_id AND s.repository_id = r.id'
  + ' AND s.source_key IN (?)) THEN \'unavailable\''
  + ' WHEN r.private AND (r.integration_id IS NULL OR r.integration_id NOT IN (?)) THEN \'unavailable\''
  + ' WHEN EXISTS (SELECT 1 FROM repositories_sources s JOIN repositories_source_statuses st'
  + ' ON st.user_id = s.user_id AND st.source_key = s.source_key'
  + ' WHERE s.user_id = r.user_id AND s.repository_id = r.id AND s.source_key IN (?) AND st.status IN (?)) THEN \'added\''
  + ' ELSE \'unknown\' END';

const COLUMNS = 'r.id, r.github_id, r.owner, r.name, r.private, r.added_at, r.integration_id, r.last_seen_at';

/**
 * The listing's SQL (`docs/agents/backend/routes/repositories.md#listing`): every query
 * is scoped `user_id = :userId`, the row status is derived in SQL so the
 * filter applies before pagination, the search is a bound, escaped `LIKE`,
 * and the sort is fixed (case-insensitive `owner`, `name`, then `github_id`).
 */
@Injectable()
export class RepositoriesListingQuery {
  /**
   * @param {DataSource} dataSource - The connection.
   */
  constructor(private readonly dataSource: DataSource) {}

  /**
   * One page of the user's rows matching the filter and search, with the filtered total.
   * @param {number} userId - The user.
   * @param {ListInput} input - Page, filter and search.
   * @param {ListingScope} scope - The current sources.
   * @returns {Promise<{ rows: ListedRepository[], total: number }>} The page and the total.
   */
  async page(userId: number, input: ListInput, scope: ListingScope): Promise<{ rows: ListedRepository[]; total: number }> {
    const filtered = this.#filtered(userId, input, scope);
    const counted: Array<{ total: string | number }> = await this.dataSource.query(
      `SELECT COUNT(*) AS total ${filtered.sql}`, filtered.params,
    );
    const raw: RawRow[] = await this.dataSource.query(
      `SELECT t.* ${filtered.sql} ORDER BY LOWER(t.owner), LOWER(t.name), t.github_id LIMIT ? OFFSET ?`,
      [...filtered.params, input.perPage, (input.page - 1) * input.perPage],
    );
    const rows = await this.#withSources(userId, raw, scope);

    return { rows: rows.map((row) => row.repository), total: Number(counted[0].total) };
  }

  /**
   * One of the user's rows, in the listing shape.
   * @param {number} userId - The user.
   * @param {RowSelector} selector - The row.
   * @param {ListingScope} scope - The current sources.
   * @returns {Promise<ListingRow | null>} The row, or `null` when the user holds none.
   */
  async one(userId: number, selector: RowSelector, scope: ListingScope): Promise<ListingRow | null> {
    const where: Sql = 'id' in selector
      ? { sql: ' AND r.id = ?', params: [selector.id] }
      : { sql: ' AND r.github_id = ?', params: [selector.githubId] };
    const inner = this.#inner(userId, scope, where);
    const raw: RawRow[] = await this.dataSource.query(`SELECT t.* FROM (${inner.sql}) t`, inner.params);

    return (await this.#withSources(userId, raw, scope))[0] ?? null;
  }

  /**
   * The `FROM … WHERE` part shared by the count and the page.
   * @param {number} userId - The user.
   * @param {ListInput} input - Filter and search.
   * @param {ListingScope} scope - The current sources.
   * @returns {Sql} The fragment and its parameters.
   */
  #filtered(userId: number, input: ListInput, scope: ListingScope): Sql {
    const search = input.search === ''
      ? { sql: '', params: [] }
      : { sql: ' AND LOWER(CONCAT(r.owner, \'/\', r.name)) LIKE ? ESCAPE \'\\\\\'', params: [`%${escapeLike(input.search.toLowerCase())}%`] };
    const inner = this.#inner(userId, scope, search);
    const filter = input.filter === 'all' ? { sql: '', params: [] } : { sql: ' WHERE t.status = ?', params: [input.filter] };

    return { sql: `FROM (${inner.sql}) t${filter.sql}`, params: [...inner.params, ...filter.params] };
  }

  /**
   * The user's rows with their derived status.
   * @param {number} userId - The user.
   * @param {ListingScope} scope - The current sources.
   * @param {Sql} where - Extra row conditions.
   * @returns {Sql} The subquery and its parameters.
   */
  #inner(userId: number, scope: ListingScope, where: Sql): Sql {
    const keys = orNone(currentKeys(scope), NO_KEY);
    const ids = orNone(scope.integrations.map((ref) => ref.id), NO_ID);

    return {
      sql: `SELECT ${COLUMNS}, ${STATUS_SQL} AS status FROM repositories r WHERE r.user_id = ?${where.sql}`,
      params: [keys, ids, keys, OK_SOURCE_STATUSES, userId, ...where.params],
    };
  }

  /**
   * Attaches each row's current sources and access integration.
   * @param {number} userId - The user.
   * @param {RawRow[]} raw - The rows.
   * @param {ListingScope} scope - The current sources.
   * @returns {Promise<ListingRow[]>} The listed rows, in order.
   */
  async #withSources(userId: number, raw: RawRow[], scope: ListingScope): Promise<ListingRow[]> {
    if (raw.length === 0) return [];

    const keysById = await this.#sourceKeys(userId, raw.map((row) => row.id), scope);
    const order = currentKeys(scope);

    return raw.map((row) => {
      const sourceKeys = order.filter((key) => keysById.get(row.id)?.has(key));

      return { id: row.id, sourceKeys, repository: toListed(row, sourceKeys, scope) };
    });
  }

  /**
   * @param {number} userId - The user.
   * @param {number[]} ids - The rows.
   * @param {ListingScope} scope - The current sources.
   * @returns {Promise<Map<number, Set<string>>>} The current source keys holding each row.
   */
  async #sourceKeys(userId: number, ids: number[], scope: ListingScope): Promise<Map<number, Set<string>>> {
    const rows: Array<{ repository_id: number; source_key: string }> = await this.dataSource.query(
      'SELECT repository_id, source_key FROM repositories_sources WHERE user_id = ? AND repository_id IN (?) AND source_key IN (?)',
      [userId, ids, orNone(currentKeys(scope), NO_KEY)],
    );
    const byId = new Map<number, Set<string>>();

    for (const row of rows) byId.set(row.repository_id, (byId.get(row.repository_id) ?? new Set()).add(row.source_key));

    return byId;
  }
}

/**
 * Escapes the `LIKE` metacharacters (`%`, `_`, `\`) so they match literally (`ESCAPE '\'`).
 * @param {string} value - The search text.
 * @returns {string} The escaped text.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * @param {ListingScope} scope - The current sources.
 * @returns {string[]} Their keys: integrations oldest first, then the handle.
 */
export function currentKeys(scope: ListingScope): string[] {
  const keys = scope.integrations.map((ref) => integrationSourceKey(ref.id));

  return scope.handle === null ? keys : [...keys, HANDLE_SOURCE_KEY];
}

/**
 * @param {ListingScope} scope - The current sources.
 * @param {string} key - A current source key.
 * @returns {SourceRef} Its public reference.
 */
export function sourceRef(scope: ListingScope, key: string): SourceRef {
  if (key === HANDLE_SOURCE_KEY) return { kind: 'handle', handle: scope.handle as string };

  const ref = scope.integrations.find((candidate) => integrationSourceKey(candidate.id) === key) as IntegrationRef;

  return { kind: 'integration', integration: summary(ref) };
}

/**
 * @param {IntegrationRef} ref - An integration.
 * @returns {IntegrationSummary} Its `uuid` and `label` only.
 */
export function summary(ref: IntegrationRef): IntegrationSummary {
  return { uuid: ref.uuid, label: ref.label };
}

/**
 * @param {RawRow} row - A raw row.
 * @param {string[]} sourceKeys - Its current source keys.
 * @param {ListingScope} scope - The current sources.
 * @returns {ListedRepository} The listing shape.
 */
function toListed(row: RawRow, sourceKeys: string[], scope: ListingScope): ListedRepository {
  const link = effectiveIntegrationId(row.integration_id, new Set(scope.integrations.map((ref) => ref.id)));
  const access = row.added_at === null || link === null ? undefined : scope.integrations.find((ref) => ref.id === link);

  return {
    githubId: Number(row.github_id),
    owner: row.owner,
    name: row.name,
    fullName: `${row.owner}/${row.name}`,
    private: Number(row.private) === 1,
    status: row.status,
    addedAt: row.added_at,
    lastSeenAt: row.last_seen_at,
    sources: sourceKeys.map((key) => sourceRef(scope, key)),
    accessIntegration: access === undefined ? null : summary(access),
  };
}

/**
 * @param {T[]} values - A list.
 * @param {T} sentinel - A value matching nothing.
 * @returns {T[]} The list, or `[sentinel]` when empty (keeps `IN (?)` valid).
 */
function orNone<T>(values: T[], sentinel: T): T[] {
  return values.length === 0 ? [sentinel] : values;
}
