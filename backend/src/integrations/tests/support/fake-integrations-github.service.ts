import type { GithubCase, GithubOperation } from './github-builders.js';
import { deferred, type Deferred } from './no-network-guard.js';
import type { IntegrationRef, RepoPageResult, RepoResult } from '../../github-repo-results.js';
import type { IntegrationsGithubService } from '../../integrations-github.service.js';

/** A scripted answer: a builder case, or a typed result. */
export type FakeAnswer = GithubCase | RepoPageResult | RepoResult;

/** One logged call. */
export interface FakeCall {
  operation: GithubOperation | 'listUsableIntegrations' | 'listIntegrations';
  userId: number;
  integrationId?: number | null;
  /** The page (listings) or the `githubId` (`getRepository`). */
  page?: number;
  etag?: string | null;
  handle?: string;
}

// The script slot that answers any page of a (integration, operation) pair.
const ANY_PAGE = '*';

/**
 * A scriptable `IntegrationsGithubService` for the Repositories specs
 * (`docs/agents/modules/repositories.md#repositories-typed-fake`). It answers
 * the exported typed results only and never touches `fetch`.
 *
 * - **Scripting:** `script(integrationId | null, operation, page | '*', ...answers)`;
 *   for `getRepository` the "page" slot is the `githubId`. Answers are used
 *   in order, the last one sticking. An unscripted call throws.
 * - **Integrations:** `setUsable` / `setIntegrations` set what the two list
 *   operations answer; with no `setIntegrations`, `listIntegrations` answers
 *   the usable list (every integration usable).
 * - **Call log:** `calls` records every call, the list operations included,
 *   so a spec asserts counts, order and "no GitHub call" (`githubCalls()`).
 * - **Deferred answers:** `hold(...)` parks the next call of a slot on a
 *   deferred promise, released by the spec (race specs).
 * - Add's candidate walk runs the shared `walkAddCandidates` over this
 *   fake's `getRepository`, like it does over the real service.
 */
export class FakeIntegrationsGithubService implements Pick<
  IntegrationsGithubService,
  'listUsableIntegrations' | 'listIntegrations' | 'listRepositories' | 'listHandleRepositories' | 'getRepository'
> {
  readonly calls: FakeCall[] = [];
  readonly #usable = new Map<number, IntegrationRef[]>();
  readonly #all = new Map<number, IntegrationRef[]>();
  readonly #scripts = new Map<string, FakeAnswer[]>();
  readonly #held = new Map<string, Deferred<FakeAnswer>[]>();

  /**
   * Sets what `listUsableIntegrations` answers for a user.
   * @param {number} userId - The user.
   * @param {IntegrationRef[]} refs - The usable integrations, oldest first.
   * @returns {this} The fake.
   */
  setUsable(userId: number, refs: IntegrationRef[]): this {
    this.#usable.set(userId, refs);
    return this;
  }

  /**
   * Sets what `listIntegrations` answers for a user (usable or not, oldest first).
   * @param {number} userId - The user.
   * @param {IntegrationRef[]} refs - Every integration of the user.
   * @returns {this} The fake.
   */
  setIntegrations(userId: number, refs: IntegrationRef[]): this {
    this.#all.set(userId, refs);
    return this;
  }

  /**
   * Scripts the answers of one slot.
   * @param {number | null} integrationId - The integration, or `null` (unauthenticated).
   * @param {GithubOperation} operation - The operation.
   * @param {number | '*'} page - The page (`githubId` for `getRepository`), or `'*'` for any.
   * @param {...FakeAnswer} answers - The answers, used in order (the last one sticks).
   * @returns {this} The fake.
   */
  script(integrationId: number | null, operation: GithubOperation, page: number | '*', ...answers: FakeAnswer[]): this {
    this.#scripts.set(slotKey(integrationId, operation, page), [...answers]);
    return this;
  }

  /**
   * Parks the next call of a slot until the spec resolves the returned deferred.
   * @param {number | null} integrationId - The integration, or `null`.
   * @param {GithubOperation} operation - The operation.
   * @param {number | '*'} page - The page (`githubId` for `getRepository`), or `'*'`.
   * @returns {Deferred<FakeAnswer>} Resolve it with the answer to release the call.
   */
  hold(integrationId: number | null, operation: GithubOperation, page: number | '*'): Deferred<FakeAnswer> {
    const held = deferred<FakeAnswer>();
    const key = slotKey(integrationId, operation, page);

    this.#held.set(key, [...(this.#held.get(key) ?? []), held]);

    return held;
  }

  /**
   * The logged calls that stand for a GitHub call (every operation but the two list operations).
   * @returns {FakeCall[]} The calls.
   */
  githubCalls(): FakeCall[] {
    return this.calls.filter((call) => call.operation !== 'listUsableIntegrations' && call.operation !== 'listIntegrations');
  }

  async listUsableIntegrations(userId: number): Promise<IntegrationRef[]> {
    this.calls.push({ operation: 'listUsableIntegrations', userId });
    return [...(this.#usable.get(userId) ?? [])];
  }

  async listIntegrations(userId: number): Promise<IntegrationRef[]> {
    this.calls.push({ operation: 'listIntegrations', userId });
    return [...(this.#all.get(userId) ?? this.#usable.get(userId) ?? [])];
  }

  listRepositories(userId: number, integrationId: number, page: number, etag?: string | null): Promise<RepoPageResult> {
    this.calls.push({ operation: 'listRepositories', userId, integrationId, page, etag: etag ?? null });
    return this.#answer(integrationId, 'listRepositories', page) as Promise<RepoPageResult>;
  }

  listHandleRepositories(
    userId: number,
    integrationId: number | null,
    handle: string,
    page: number,
    etag?: string | null,
  ): Promise<RepoPageResult> {
    this.calls.push({ operation: 'listHandleRepositories', userId, integrationId, handle, page, etag: etag ?? null });
    return this.#answer(integrationId, 'listHandleRepositories', page) as Promise<RepoPageResult>;
  }

  getRepository(userId: number, integrationId: number | null, githubId: number): Promise<RepoResult> {
    this.calls.push({ operation: 'getRepository', userId, integrationId, page: githubId });
    return this.#answer(integrationId, 'getRepository', githubId) as Promise<RepoResult>;
  }

  async #answer(integrationId: number | null, operation: GithubOperation, page: number): Promise<RepoPageResult | RepoResult> {
    const held = this.#takeHeld(integrationId, operation, page);
    const answer = held === undefined ? this.#scripted(integrationId, operation, page) : await held.promise;

    return isCase(answer) ? answer.resultFor(operation) : answer;
  }

  #takeHeld(integrationId: number | null, operation: GithubOperation, page: number): Deferred<FakeAnswer> | undefined {
    for (const key of [slotKey(integrationId, operation, page), slotKey(integrationId, operation, ANY_PAGE)]) {
      const queue = this.#held.get(key);

      if (queue !== undefined && queue.length > 0) {
        return queue.shift();
      }
    }

    return undefined;
  }

  #scripted(integrationId: number | null, operation: GithubOperation, page: number): FakeAnswer {
    const queue = this.#scripts.get(slotKey(integrationId, operation, page))
      ?? this.#scripts.get(slotKey(integrationId, operation, ANY_PAGE));

    if (queue === undefined || queue.length === 0) {
      throw new Error(`FakeIntegrationsGithubService: unscripted ${operation}(${String(integrationId)}, ${page})`);
    }

    return queue.length > 1 ? queue.shift() as FakeAnswer : queue[0];
  }
}

/**
 * The script slot key.
 * @param {number | null} integrationId - The integration, or `null`.
 * @param {GithubOperation} operation - The operation.
 * @param {number | '*'} page - The page, `githubId` or `'*'`.
 * @returns {string} The key.
 */
function slotKey(integrationId: number | null, operation: GithubOperation, page: number | '*'): string {
  return `${integrationId === null ? 'null' : integrationId}|${operation}|${page}`;
}

/**
 * Whether an answer is a builder case (rather than a typed result).
 * @param {FakeAnswer} answer - The answer.
 * @returns {boolean} `true` for a case.
 */
function isCase(answer: FakeAnswer): answer is GithubCase {
  return typeof (answer as GithubCase).resultFor === 'function';
}
