import { Injectable } from '@nestjs/common';
import { PageWriter, type SourceEndWrite, type StoredPage, type WriteTarget } from './page-writer.js';
import { HANDLE_SOURCE_KEY } from './source-key.js';
import { Clock } from '../core/clock.js';
import { IntegrationsGithubService, type RepoPageResult } from '../integrations/integrations-github.public.js';

/** One source of a run. */
export type SourcePlan =
  | { kind: 'integration'; key: string; integrationId: number }
  | { kind: 'handle'; handle: string; credentials: Array<number | null> };

/** What a run needs to know while running a source. */
export interface RunContext {
  userId: number;
  runId: string;
  /** The handle the run started with. */
  handle: string | null;
  /** The hard deadline, checked between pages. */
  deadline: Date;
  pageCap: number;
}

/** How a source ended for the run: `lost` stops the whole run. */
export type SourceEnd = 'done' | 'lost';

/** The outcome of walking a source's pages with one credential. */
type Walk =
  | { kind: 'end'; end: SourceEndWrite }
  | { kind: 'next_credential' }
  | { kind: 'stop'; reason: 'lost' | 'handle_changed' | 'missing' };

/** One applied page: continue with `hasNext`, or stop the walk. */
type Step = { kind: 'continue'; hasNext: boolean } | Walk;

/**
 * Runs one source of a sync, page by page up to the page cap
 * (`docs/agents/specs/repos/sync.md#per-source`): conditional requests with
 * the stored ETags (the last stored page always without one), each page
 * fetched before its guarded transaction, the handle's credential fallback on
 * `invalid_credentials`, and the end-of-source write.
 */
@Injectable()
export class SourceRunner {
  /**
   * @param {IntegrationsGithubService} github - Integrations' exported GitHub service.
   * @param {PageWriter} writer - The guarded transactions.
   * @param {Clock} clock - The time source (hard deadline).
   */
  constructor(
    private readonly github: IntegrationsGithubService,
    private readonly writer: PageWriter,
    private readonly clock: Clock,
  ) {}

  /**
   * Runs a source to its end.
   * @param {RunContext} ctx - The run.
   * @param {SourcePlan} plan - The source.
   * @returns {Promise<SourceEnd>} `lost` when the run lost its lease or row.
   */
  async run(ctx: RunContext, plan: SourcePlan): Promise<SourceEnd> {
    const target = this.#target(ctx, plan);
    const pages = await this.writer.storedPages(ctx.userId, target.sourceKey);
    const credentials = plan.kind === 'handle' ? plan.credentials : [plan.integrationId];
    let walk: Walk = { kind: 'end', end: { kind: 'failure', status: 'error', resetAt: null } };

    for (const credential of credentials) {
      walk = await this.#walk(ctx, plan, target, pages, credential);
      if (walk.kind !== 'next_credential') break;
    }
    if (walk.kind === 'next_credential') walk = { kind: 'end', end: { kind: 'failure', status: 'error', resetAt: null } };
    if (walk.kind === 'stop') return walk.reason === 'lost' ? 'lost' : 'done';

    return (await this.writer.endSource(target, walk.end)) === 'lost' ? 'lost' : 'done';
  }

  /**
   * Walks the pages with one credential.
   * @param {RunContext} ctx - The run.
   * @param {SourcePlan} plan - The source.
   * @param {WriteTarget} target - The write target.
   * @param {Map<number, StoredPage>} pages - The stored pages.
   * @param {number | null} credential - The integration to call with, or `null`.
   * @returns {Promise<Walk>} How the walk ended.
   */
  async #walk(
    ctx: RunContext,
    plan: SourcePlan,
    target: WriteTarget,
    pages: Map<number, StoredPage>,
    credential: number | null,
  ): Promise<Walk> {
    for (let page = 1; ; page += 1) {
      if (this.clock.now() > ctx.deadline) return failure('error');

      const stored = pages.get(page);
      const result = await this.#fetch(ctx, plan, credential, page, stored?.hasNext === true ? stored.etag : null);
      const step = await this.#apply(plan, target, page, stored, result);

      if (step.kind !== 'continue') return step;
      if (!step.hasNext) return { kind: 'end', end: { kind: 'success', lastPage: page, status: 'ok' } };
      if (page >= ctx.pageCap) return { kind: 'end', end: { kind: 'success', lastPage: page, status: 'page_cap_reached' } };
    }
  }

  /**
   * Fetches one page through Integrations.
   * @param {RunContext} ctx - The run.
   * @param {SourcePlan} plan - The source.
   * @param {number | null} credential - The integration, or `null`.
   * @param {number} page - The page.
   * @param {string | null} etag - The ETag to send, or `null`.
   * @returns {Promise<RepoPageResult>} The typed page.
   */
  #fetch(ctx: RunContext, plan: SourcePlan, credential: number | null, page: number, etag: string | null): Promise<RepoPageResult> {
    return plan.kind === 'handle'
      ? this.github.listHandleRepositories(ctx.userId, credential, plan.handle, page, etag)
      : this.github.listRepositories(ctx.userId, plan.integrationId, page, etag);
  }

  /**
   * Applies one page's answer.
   * @param {SourcePlan} plan - The source.
   * @param {WriteTarget} target - The write target.
   * @param {number} page - The page.
   * @param {StoredPage | undefined} stored - The stored page.
   * @param {RepoPageResult} result - The answer.
   * @returns {Promise<Step>} Continue, or how the walk ends.
   */
  async #apply(plan: SourcePlan, target: WriteTarget, page: number, stored: StoredPage | undefined, result: RepoPageResult): Promise<Step> {
    if (result.kind === 'ok') {
      const repos = plan.kind === 'handle' ? result.repos.filter((repo) => !repo.private) : result.repos;
      const guard = await this.writer.applyPage(target, page, repos, { etag: result.etag, hasNext: result.hasNext });

      return guard === 'owned' ? { kind: 'continue', hasNext: result.hasNext } : { kind: 'stop', reason: guard };
    }
    if (result.kind === 'not_modified') {
      if (stored === undefined) return failure('error');
      const guard = await this.writer.applyNotModified(target, page);

      return guard === 'owned' ? { kind: 'continue', hasNext: stored.hasNext } : { kind: 'stop', reason: guard };
    }

    return plan.kind === 'handle' ? handleFailure(result) : integrationFailure(result);
  }

  /**
   * @param {RunContext} ctx - The run.
   * @param {SourcePlan} plan - The source.
   * @returns {WriteTarget} The write target (the handle source carries the run's handle guard).
   */
  #target(ctx: RunContext, plan: SourcePlan): WriteTarget {
    return plan.kind === 'handle'
      ? { userId: ctx.userId, runId: ctx.runId, sourceKey: HANDLE_SOURCE_KEY, handleGuard: { handle: ctx.handle } }
      : { userId: ctx.userId, runId: ctx.runId, sourceKey: plan.key };
  }
}

/** A failed answer of either source kind. */
type Failure = Exclude<RepoPageResult, { kind: 'ok' } | { kind: 'not_modified' }>;

/**
 * @param {SourceEndWrite['status']} status - The failure status.
 * @param {Date | null} [resetAt] - The rate-limit reset.
 * @returns {Walk} A failure end.
 */
function failure(status: Exclude<SourceEndWrite['status'], 'ok' | 'page_cap_reached'>, resetAt: Date | null = null): Walk {
  return { kind: 'end', end: { kind: 'failure', status, resetAt } };
}

/**
 * Maps an integration source's failure (`sync.md#sources`): a non-usable
 * integration stores `invalid_credentials` (status) or `error` (type
 * disabled); a missing one stops with no status.
 * @param {Failure} result - The answer.
 * @returns {Walk} How the source ends.
 */
function integrationFailure(result: Failure): Walk {
  switch (result.kind) {
    case 'integration_unusable':
      if (result.reason === 'missing') return { kind: 'stop', reason: 'missing' };
      return failure(result.reason === 'status' ? 'invalid_credentials' : 'error');
    case 'invalid_credentials':
      return failure('invalid_credentials');
    case 'rate_limited':
      return failure('rate_limited', result.resetAt);
    default:
      return failure('error');
  }
}

/**
 * Maps a handle source's failure (`sync.md#handle-credential`): a `401` (or
 * an unusable credential) moves to the next credential; a rate limit, an
 * unavailable answer or a `404` never falls back.
 * @param {Failure} result - The answer.
 * @returns {Walk} How the walk ends.
 */
function handleFailure(result: Failure): Walk {
  switch (result.kind) {
    case 'invalid_credentials':
    case 'integration_unusable':
      return { kind: 'next_credential' };
    case 'rate_limited':
      return failure('rate_limited', result.resetAt);
    case 'not_found':
      return failure('not_found');
    default:
      return failure('error');
  }
}
