import type { IssueResponse } from '../../issue-response.js';
import type { IssueLinksService } from '../../issue-links.service.js';
import type { AttachIssueInput, ImportIssueInput, UnlinkIssueInput, UnlinkIssueResponse } from '../../types/issues-api.types.js';
import { sampleIssue } from './fake-issues.service.js';

/** The `IssueLinksService` methods the controller uses. */
export type IssueLinksServiceSurface = Pick<IssueLinksService, 'import' | 'attach' | 'unlink'>;

/** One logged call. */
export interface FakeIssueLinksCall {
  method: keyof IssueLinksServiceSurface;
  userId: number;
  args: unknown[];
}

/**
 * A recording stand-in for `IssueLinksService` in the HTTP-layer specs (the real one runs MySQL
 * and reads GitHub): every method answers a canned result, or throws the error set with
 * `failWith`, and logs its call, so a spec sees exactly what the controller validated and passed on.
 */
export class FakeIssueLinksService implements IssueLinksServiceSurface {
  readonly calls: FakeIssueLinksCall[] = [];
  issue: IssueResponse = sampleIssue();
  #failure: { method: keyof IssueLinksServiceSurface; error: Error } | null = null;

  /** Makes the next call of `method` throw `error`. */
  failWith(method: keyof IssueLinksServiceSurface, error: Error): this {
    this.#failure = { method, error };

    return this;
  }

  callsOf(method: keyof IssueLinksServiceSurface): FakeIssueLinksCall[] {
    return this.calls.filter((call) => call.method === method);
  }

  async import(userId: number, projectUuid: string, input: ImportIssueInput): Promise<IssueResponse> {
    this.#record('import', userId, projectUuid, input);

    return this.issue;
  }

  async attach(userId: number, projectUuid: string, issueUuid: string, input: AttachIssueInput): Promise<IssueResponse> {
    this.#record('attach', userId, projectUuid, issueUuid, input);

    return this.issue;
  }

  async unlink(userId: number, projectUuid: string, issueUuid: string, input: UnlinkIssueInput): Promise<UnlinkIssueResponse> {
    this.#record('unlink', userId, projectUuid, issueUuid, input);

    return { issue: this.issue, droppedUnsentChanges: false };
  }

  #record(method: keyof IssueLinksServiceSurface, userId: number, ...args: unknown[]): void {
    this.calls.push({ method, userId, args });

    if (this.#failure?.method === method) {
      const { error } = this.#failure;

      this.#failure = null;
      throw error;
    }
  }
}
