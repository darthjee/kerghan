import { sampleIssue } from './fake-issues.service.js';
import type { IssueLinksService } from '../../issue-links.service.js';
import type { IssueResponse } from '../../issue-response.js';
import type { IssueSyncTriggersService } from '../../issue-sync-triggers.service.js';
import type {
  AttachIssueInput,
  ImportIssueInput,
  RefreshIssueResponse,
  RefreshProjectResponse,
  RetrySyncResponse,
  TriggerResult,
  UnlinkIssueInput,
  UnlinkIssueResponse,
} from '../../types/issues-api.types.js';

/** The `IssueLinksService` and `IssueSyncTriggersService` methods the controller uses. */
export type IssueLinksServiceSurface =
  & Pick<IssueLinksService, 'import' | 'attach' | 'unlink'>
  & Pick<IssueSyncTriggersService, 'refreshIssue' | 'refreshProject' | 'retrySync'>;

/** One logged call. */
export interface FakeIssueLinksCall {
  method: keyof IssueLinksServiceSurface;
  userId: number;
  args: unknown[];
}

/**
 * A recording stand-in for `IssueLinksService` and `IssueSyncTriggersService` in the HTTP-layer
 * specs (the real ones run MySQL and read GitHub): every method answers a canned result, or throws
 * the error set with `failWith`, and logs its call, so a spec sees exactly what the controller
 * validated and passed on. The trigger methods answer `202` unless `triggerStatus` says otherwise.
 */
export class FakeIssueLinksService implements IssueLinksServiceSurface {
  readonly calls: FakeIssueLinksCall[] = [];
  issue: IssueResponse = sampleIssue();
  /** The status the trigger methods answer (`202` enqueued, `200` skipped or no-op). */
  triggerStatus = 202;
  /** The counts T3 answers. */
  projectRefresh: RefreshProjectResponse = { enqueued: 2, skippedFresh: 1 };
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

  async refreshIssue(userId: number, projectUuid: string, issueUuid: string): Promise<TriggerResult<RefreshIssueResponse>> {
    this.#record('refreshIssue', userId, projectUuid, issueUuid);

    return { status: this.triggerStatus, body: { issue: this.issue, alreadyFresh: this.triggerStatus === 200 } };
  }

  async refreshProject(userId: number, projectUuid: string): Promise<TriggerResult<RefreshProjectResponse>> {
    this.#record('refreshProject', userId, projectUuid);

    return { status: this.triggerStatus, body: this.projectRefresh };
  }

  async retrySync(userId: number, projectUuid: string, issueUuid: string): Promise<TriggerResult<RetrySyncResponse>> {
    this.#record('retrySync', userId, projectUuid, issueUuid);

    return { status: this.triggerStatus, body: { issue: this.issue } };
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
