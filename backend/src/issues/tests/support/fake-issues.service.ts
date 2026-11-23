import type { IssueDeleteResponse, IssueListingResponse, IssueResponse } from '../../issue-response.js';
import type { IssuesService } from '../../issues.service.js';
import type { BulkIssueStateInput, BulkIssueStateResponse, CreateIssueInput, EditIssueInput, ListIssuesInput } from '../../types/issues-api.types.js';

/** The `IssuesService` methods the controller uses. */
export type IssuesServiceSurface = Pick<IssuesService, 'list' | 'create' | 'show' | 'edit' | 'bulkState' | 'delete'>;

/** One logged call. */
export interface FakeIssuesCall {
  method: keyof IssuesServiceSurface;
  userId: number;
  args: unknown[];
}

/** An issue object with every field set, for responses. */
export function sampleIssue(overrides: Partial<IssueResponse> = {}): IssueResponse {
  return {
    id: '3f2a0000-0000-4000-8000-0000000000d1',
    title: 'Fix it',
    body: null,
    state: 'open',
    createdAt: '2026-11-17T12:00:00.000Z',
    updatedAt: '2026-11-17T12:00:00.123Z',
    link: null,
    ...overrides,
  };
}

/**
 * A recording stand-in for `IssuesService` in the HTTP-layer specs (the real one runs MySQL):
 * every method answers a canned result, or throws the error set with `failWith`, and logs its
 * call (`calls`), so a spec sees exactly what the controller validated and passed on.
 */
export class FakeIssuesService implements IssuesServiceSurface {
  readonly calls: FakeIssuesCall[] = [];
  issue: IssueResponse = sampleIssue();
  listing: IssueListingResponse = { issues: [], pagination: { page: 1, perPage: 50, total: 0, totalPages: 0 } };
  #failure: { method: keyof IssuesServiceSurface; error: Error } | null = null;

  /** Makes the next call of `method` throw `error`. */
  failWith(method: keyof IssuesServiceSurface, error: Error): this {
    this.#failure = { method, error };

    return this;
  }

  callsOf(method: keyof IssuesServiceSurface): FakeIssuesCall[] {
    return this.calls.filter((call) => call.method === method);
  }

  async list(userId: number, projectUuid: string, input: ListIssuesInput): Promise<IssueListingResponse> {
    this.#record('list', userId, projectUuid, input);

    return this.listing;
  }

  async create(userId: number, projectUuid: string, input: CreateIssueInput): Promise<IssueResponse> {
    this.#record('create', userId, projectUuid, input);

    return this.issue;
  }

  async show(userId: number, projectUuid: string, issueUuid: string): Promise<IssueResponse> {
    this.#record('show', userId, projectUuid, issueUuid);

    return this.issue;
  }

  async edit(userId: number, projectUuid: string, issueUuid: string, input: EditIssueInput): Promise<IssueResponse> {
    this.#record('edit', userId, projectUuid, issueUuid, input);

    return this.issue;
  }

  async bulkState(userId: number, projectUuid: string, input: BulkIssueStateInput): Promise<BulkIssueStateResponse> {
    this.#record('bulkState', userId, projectUuid, input);

    return { state: input.state, changed: input.issueIds, unchanged: [], notFound: [] };
  }

  async delete(userId: number, projectUuid: string, issueUuid: string): Promise<IssueDeleteResponse> {
    this.#record('delete', userId, projectUuid, issueUuid);

    return {};
  }

  #record(method: keyof IssuesServiceSurface, userId: number, ...args: unknown[]): void {
    this.calls.push({ method, userId, args });

    if (this.#failure?.method === method) {
      const { error } = this.#failure;

      this.#failure = null;
      throw error;
    }
  }
}
