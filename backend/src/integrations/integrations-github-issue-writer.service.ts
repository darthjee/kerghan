import { Injectable } from '@nestjs/common';
import { GithubAuthenticatedRunner } from './github-authenticated-runner.js';
import { ISSUE_WRITE_PERMISSIONS } from './github-installation-permissions.js';
import { GithubIssueClientService } from './github-issue-client.service.js';
import type { GithubIssueChanges, GithubIssueRepo, IssueUpdateResult } from './github-issue-results.js';

// The only fields a write may send.
const CHANGE_FIELDS: ReadonlySet<string> = new Set(['title', 'body', 'state']);

/**
 * The one write the Integrations module makes to GitHub with a user's
 * credential: `PATCH /repos/{owner}/{name}/issues/{number}` with a
 * `title`/`body`/`state` diff (see
 * `docs/agents/modules/issues/security.md#write-access-to-github`).
 *
 * This is the only non-`GET` GitHub call made with a user's credential, and
 * only the issues sync service may inject it (#558); a static spec fails when
 * any file outside Integrations does. `IntegrationsGithubService` stays
 * `GET`-only.
 */
@Injectable()
export class IntegrationsGithubIssueWriter {
  /**
   * @param {GithubAuthenticatedRunner} runner - The shared authenticated path.
   * @param {GithubIssueClientService} issueClient - The issue HTTP client.
   */
  constructor(
    private readonly runner: GithubAuthenticatedRunner,
    private readonly issueClient: GithubIssueClientService,
  ) {}

  /**
   * Updates one GitHub issue with the diff it was given (never a full `PATCH`).
   * A rename redirect is followed once, resending the same body, and reported as `renamedTo`.
   * @param {number} userId - The owner's id.
   * @param {number} integrationId - The internal `integrations.id`.
   * @param {GithubIssueRepo} repo - The repository row's id and names.
   * @param {number} number - The issue number.
   * @param {GithubIssueChanges} changes - The diff: `title`, `body` and `state` only, at least one.
   * @returns {Promise<IssueUpdateResult>} The typed updated issue.
   * @throws {TypeError} Before any load or call, when `changes` holds another field, an invalid value or nothing.
   */
  updateIssue(
    userId: number,
    integrationId: number,
    repo: GithubIssueRepo,
    number: number,
    changes: GithubIssueChanges,
  ): Promise<IssueUpdateResult> {
    assertIssueChanges(changes);

    return this.runner.run<IssueUpdateResult>(userId, integrationId, 'update_issue', ISSUE_WRITE_PERMISSIONS, (token) =>
      this.issueClient.updateIssue(token, repo, number, changes));
  }
}

/**
 * Validates a diff; the messages are fixed and never echo a value. Shared with
 * the typed fake, so a spec cannot pass with a payload the writer would refuse.
 * @param {GithubIssueChanges} changes - The diff.
 * @returns {void}
 * @throws {TypeError} When `changes` holds another field, an invalid value or nothing.
 */
export function assertIssueChanges(changes: GithubIssueChanges): void {
  const fields = Object.keys(changes);

  if (fields.some((key) => !CHANGE_FIELDS.has(key))) {
    throw new TypeError('changes may only hold title, body and state');
  }

  assertValues(changes);

  if (fields.every((key) => changes[key as keyof GithubIssueChanges] === undefined)) {
    throw new TypeError('changes must not be empty');
  }
}

/**
 * Validates the values of a diff's fields; the messages are fixed and never echo a value.
 * @param {GithubIssueChanges} changes - The diff.
 * @returns {void}
 */
function assertValues(changes: GithubIssueChanges): void {
  if (changes.title !== undefined && typeof changes.title !== 'string') {
    throw new TypeError('title must be a string');
  }

  if (changes.body !== undefined && changes.body !== null && typeof changes.body !== 'string') {
    throw new TypeError('body must be a string or null');
  }

  if (changes.state !== undefined && changes.state !== 'open' && changes.state !== 'closed') {
    throw new TypeError('state must be open or closed');
  }
}
