import {
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ErrorCodes } from '../core/error-codes.js';

// One message for a missing, foreign or deleted project, so existence never leaks.
export const PROJECT_NOT_FOUND_MESSAGE = 'Project not found';
// Same message as Add's repository `404` (`repositories-http-errors.ts`), so the bodies match
// byte for byte; Issues may not import Repositories' error helpers (eslint boundary).
export const REPOSITORY_NOT_FOUND_MESSAGE = 'Repository not found';
// One message for a missing issue or one that belongs to another project.
export const ISSUE_NOT_FOUND_MESSAGE = 'Issue not found';

/**
 * 404 `NOT_FOUND`: the single answer for a project that is missing, another user's or deleted,
 * so every body is byte-identical (`docs/agents/backend/routes/issues/errors-and-validation.md`).
 * @returns {NotFoundException} The exception.
 */
export function projectNotFound(): NotFoundException {
  return new NotFoundException(PROJECT_NOT_FOUND_MESSAGE);
}

/**
 * 404 `NOT_FOUND`: the single answer for an issue that is missing or in another project.
 * @returns {NotFoundException} The exception.
 */
export function issueNotFound(): NotFoundException {
  return new NotFoundException(ISSUE_NOT_FOUND_MESSAGE);
}

/**
 * 404 `NOT_FOUND`: a repo ref not among the caller's rows, identical to Add's repository `404`.
 * @returns {NotFoundException} The exception.
 */
export function repositoryNotFound(): NotFoundException {
  return new NotFoundException(REPOSITORY_NOT_FOUND_MESSAGE);
}

/**
 * 409 `PROJECTS_LIMIT_REACHED`: the caller already has the maximum number of live projects.
 * @returns {ConflictException} The exception.
 */
export function projectsLimitReached(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.PROJECTS_LIMIT_REACHED,
    message: 'You reached the maximum number of projects',
  });
}

/**
 * 409 `PROJECT_NAME_TAKEN`: another live project of the caller has this name.
 * @returns {ConflictException} The exception.
 */
export function projectNameTaken(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.PROJECT_NAME_TAKEN,
    message: 'A project with this name already exists',
  });
}

/**
 * 409 `PROJECT_REPOSITORY_TAKEN`: the repository already has a project of the caller.
 * @param {string} projectUuid - The public id of the existing project, exposed as `meta.projectId`.
 * @returns {ConflictException} The exception.
 */
export function projectRepositoryTaken(projectUuid: string): ConflictException {
  return new ConflictException({
    code: ErrorCodes.PROJECT_REPOSITORY_TAKEN,
    message: 'This repository already has a project',
    meta: { projectId: projectUuid },
  });
}

/**
 * 409 `PROJECT_REPOSITORY_NOT_ADDED`: the caller's repository row exists but is not added.
 * @returns {ConflictException} The exception.
 */
export function projectRepositoryNotAdded(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.PROJECT_REPOSITORY_NOT_ADDED,
    message: 'Add this repository first',
  });
}

/**
 * 409 `PROJECT_HAS_LINKS`: a repository change or detach while the project still has links.
 * @param {number} linkCount - The number of links, exposed as `meta.linkCount`.
 * @returns {ConflictException} The exception.
 */
export function projectHasLinks(linkCount: number): ConflictException {
  return new ConflictException({
    code: ErrorCodes.PROJECT_HAS_LINKS,
    message: "Unlink the project's issues before changing its repository",
    meta: { linkCount },
  });
}

/**
 * 409 `ISSUES_LIMIT_REACHED`: the project already holds the maximum number of issues.
 * @returns {ConflictException} The exception.
 */
export function issuesLimitReached(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.ISSUES_LIMIT_REACHED,
    message: 'This project reached the maximum number of issues',
  });
}

/**
 * 429 `ISSUE_EDIT_RATE_LIMITED`, with `Retry-After` and `error.retryAfterSeconds`.
 * @param {number} retryAfterSeconds - Seconds until the user's edit window resets.
 * @returns {HttpException} The exception.
 */
export function issueEditRateLimited(retryAfterSeconds: number): HttpException {
  return new HttpException(
    {
      code: ErrorCodes.ISSUE_EDIT_RATE_LIMITED,
      message: 'Too many edits; try again later',
      retryAfterSeconds,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

/**
 * 409 `ISSUE_LINKED`: a delete of an issue that still has a GitHub link.
 * @returns {ConflictException} The exception.
 */
export function issueLinked(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.ISSUE_LINKED,
    message: 'Unlink this issue before deleting it',
  });
}

/** The fields an attach may overwrite, in the order `meta.differences` lists them. */
export type AttachDifference = 'title' | 'body' | 'state';

/** Why the integration chosen for a repository cannot be used. */
export type CredentialUnusableReason = 'no_credential' | 'credential_invalid' | 'forbidden';

/**
 * 404 `GITHUB_ISSUE_NOT_FOUND`: GitHub has no such issue (distinct from the Kerghan `404 NOT_FOUND`).
 * @returns {NotFoundException} The exception.
 */
export function githubIssueNotFound(): NotFoundException {
  return new NotFoundException({
    code: ErrorCodes.GITHUB_ISSUE_NOT_FOUND,
    message: 'GitHub issue not found',
  });
}

/**
 * 409 `PROJECT_HAS_NO_REPOSITORY`: a link operation on a project without a repository.
 * @returns {ConflictException} The exception.
 */
export function projectHasNoRepository(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.PROJECT_HAS_NO_REPOSITORY,
    message: 'This project has no repository',
  });
}

/**
 * 409 `PROJECT_REPOSITORY_UNAVAILABLE`: the project's repository row is gone or no longer usable.
 * @returns {ConflictException} The exception.
 */
export function projectRepositoryUnavailable(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.PROJECT_REPOSITORY_UNAVAILABLE,
    message: "The project's repository is unavailable",
  });
}

/**
 * 409 `PROJECT_REPOSITORY_CHANGED`: the project's repository changed while the link was being made.
 * @returns {ConflictException} The exception.
 */
export function projectRepositoryChanged(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.PROJECT_REPOSITORY_CHANGED,
    message: "The project's repository changed; try again",
  });
}

/**
 * 409 `GITHUB_ISSUE_ALREADY_LINKED`: the GitHub issue is already linked by the caller.
 * @param {string} projectUuid - The public id of the existing link's project, exposed as `meta.projectId`.
 * @param {string} issueUuid - The public id of the existing link's issue, exposed as `meta.issueId`.
 * @returns {ConflictException} The exception.
 */
export function githubIssueAlreadyLinked(projectUuid: string, issueUuid: string): ConflictException {
  return new ConflictException({
    code: ErrorCodes.GITHUB_ISSUE_ALREADY_LINKED,
    message: 'This GitHub issue is already linked',
    meta: { projectId: projectUuid, issueId: issueUuid },
  });
}

/**
 * 409 `ISSUE_ALREADY_LINKED`: an attach to an issue that already has a link.
 * @returns {ConflictException} The exception.
 */
export function issueAlreadyLinked(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.ISSUE_ALREADY_LINKED,
    message: 'This issue is already linked',
  });
}

/**
 * 409 `ISSUE_ATTACH_CONFIRMATION_REQUIRED`: the attach would replace values and was not confirmed.
 * @param {AttachDifference[]} differences - The fields that differ, in the order title, body, state.
 * @param {string} updatedAt - The issue's `updatedAt` as an ISO string with milliseconds.
 * @returns {ConflictException} The exception.
 */
export function issueAttachConfirmationRequired(differences: AttachDifference[], updatedAt: string): ConflictException {
  return new ConflictException({
    code: ErrorCodes.ISSUE_ATTACH_CONFIRMATION_REQUIRED,
    message: "Attaching replaces this issue's values",
    meta: { differences, updatedAt },
  });
}

/**
 * 409 `ISSUE_NOT_LINKED`: an unlink of an issue that has no link.
 * @returns {ConflictException} The exception.
 */
export function issueNotLinked(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.ISSUE_NOT_LINKED,
    message: 'This issue is not linked',
  });
}

/**
 * 409 `ISSUE_UNLINK_HAS_UNSENT_CHANGES`: an unlink that would drop unsent changes without consent.
 * @returns {ConflictException} The exception.
 */
export function issueUnlinkHasUnsentChanges(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.ISSUE_UNLINK_HAS_UNSENT_CHANGES,
    message: 'This issue has changes not yet sent to GitHub',
  });
}

/**
 * 409 `GITHUB_CREDENTIAL_UNUSABLE`: the integration for the repository needs attention.
 * @param {CredentialUnusableReason} reason - Exposed as `meta.reason`.
 * @returns {ConflictException} The exception.
 */
export function githubCredentialUnusable(reason: CredentialUnusableReason): ConflictException {
  return new ConflictException({
    code: ErrorCodes.GITHUB_CREDENTIAL_UNUSABLE,
    message: 'The integration for this repository needs attention',
    meta: { reason },
  });
}

/**
 * 422 `GITHUB_ISSUE_IS_PULL_REQUEST`: the GitHub number is a pull request.
 * @returns {UnprocessableEntityException} The exception.
 */
export function githubIssueIsPullRequest(): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: ErrorCodes.GITHUB_ISSUE_IS_PULL_REQUEST,
    message: 'This is a pull request, not an issue',
  });
}

/**
 * 429 `ISSUE_LINK_RATE_LIMITED`, with `Retry-After` and `error.retryAfterSeconds`.
 * @param {number} retryAfterSeconds - Seconds until the user's link window resets.
 * @returns {HttpException} The exception.
 */
export function issueLinkRateLimited(retryAfterSeconds: number): HttpException {
  return new HttpException(
    {
      code: ErrorCodes.ISSUE_LINK_RATE_LIMITED,
      message: 'Too many link requests; try again later',
      retryAfterSeconds,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

/**
 * 409 `ISSUE_LINK_GONE`: a refresh or retry of a `gone` link, which is left only by unlinking.
 * @returns {ConflictException} The exception.
 */
export function issueLinkGone(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.ISSUE_LINK_GONE,
    message: 'The GitHub issue is no longer available',
  });
}
