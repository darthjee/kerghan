import { ErrorCodes } from '../../core/error-codes.js';
import { repositoryNotFound as addRepositoryNotFound } from '../../repositories/repositories-http-errors.js';
import {
  githubCredentialUnusable,
  githubIssueAlreadyLinked,
  githubIssueIsPullRequest,
  githubIssueNotFound,
  issueAlreadyLinked,
  issueAttachConfirmationRequired,
  issueEditRateLimited,
  issueLinkGone,
  issueLinkRateLimited,
  issueNotLinked,
  issueUnlinkHasUnsentChanges,
  projectHasNoRepository,
  projectRepositoryChanged,
  projectRepositoryUnavailable,
  issueLinked,
  issueNotFound,
  issuesLimitReached,
  projectHasLinks,
  projectNameTaken,
  projectNotFound,
  projectRepositoryNotAdded,
  projectRepositoryTaken,
  projectsLimitReached,
  repositoryNotFound,
} from '../issues-http-errors.js';

describe('issues-http-errors', () => {
  it.each([
    ['projectNotFound', projectNotFound(), 'Project not found'],
    ['issueNotFound', issueNotFound(), 'Issue not found'],
    ['repositoryNotFound', repositoryNotFound(), 'Repository not found'],
  ])('%s is a plain 404 with the category message', (_name, error, message) => {
    expect(error.getStatus()).toBe(404);
    expect(error.getResponse()).toEqual(expect.objectContaining({ message }));
  });

  it('answers the repository 404 byte for byte like Add', () => {
    expect(repositoryNotFound().getResponse()).toEqual(addRepositoryNotFound().getResponse());
  });

  it.each([
    ['projectsLimitReached', projectsLimitReached(), ErrorCodes.PROJECTS_LIMIT_REACHED, 'You reached the maximum number of projects'],
    ['projectNameTaken', projectNameTaken(), ErrorCodes.PROJECT_NAME_TAKEN, 'A project with this name already exists'],
    ['projectRepositoryNotAdded', projectRepositoryNotAdded(), ErrorCodes.PROJECT_REPOSITORY_NOT_ADDED, 'Add this repository first'],
  ])('%s is a 409 with its code and message and no meta', (_name, error, code, message) => {
    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toEqual({ code, message });
  });

  it('projectRepositoryTaken carries the existing project id as meta.projectId', () => {
    const error = projectRepositoryTaken('3f0c1f8e-0000-4000-8000-000000000001');

    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toEqual({
      code: ErrorCodes.PROJECT_REPOSITORY_TAKEN,
      message: 'This repository already has a project',
      meta: { projectId: '3f0c1f8e-0000-4000-8000-000000000001' },
    });
  });

  it('projectHasLinks carries the link count as meta.linkCount', () => {
    const error = projectHasLinks(3);

    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toEqual({
      code: ErrorCodes.PROJECT_HAS_LINKS,
      message: "Unlink the project's issues before changing its repository",
      meta: { linkCount: 3 },
    });
  });

  it.each([
    ['issuesLimitReached', issuesLimitReached(), ErrorCodes.ISSUES_LIMIT_REACHED, 'This project reached the maximum number of issues'],
    ['issueLinked', issueLinked(), ErrorCodes.ISSUE_LINKED, 'Unlink this issue before deleting it'],
  ])('%s is a 409 with its code and message and no meta', (_name, error, code, message) => {
    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toEqual({ code, message });
  });

  it('issueEditRateLimited is a 429 carrying retryAfterSeconds', () => {
    const error = issueEditRateLimited(42);

    expect(error.getStatus()).toBe(429);
    expect(error.getResponse()).toEqual({
      code: ErrorCodes.ISSUE_EDIT_RATE_LIMITED,
      message: 'Too many edits; try again later',
      retryAfterSeconds: 42,
    });
  });
  it.each([
    ['projectHasNoRepository', projectHasNoRepository(), ErrorCodes.PROJECT_HAS_NO_REPOSITORY, 'This project has no repository'],
    [
      'projectRepositoryUnavailable',
      projectRepositoryUnavailable(),
      ErrorCodes.PROJECT_REPOSITORY_UNAVAILABLE,
      "The project's repository is unavailable",
    ],
    [
      'projectRepositoryChanged',
      projectRepositoryChanged(),
      ErrorCodes.PROJECT_REPOSITORY_CHANGED,
      "The project's repository changed; try again",
    ],
    ['issueAlreadyLinked', issueAlreadyLinked(), ErrorCodes.ISSUE_ALREADY_LINKED, 'This issue is already linked'],
    ['issueNotLinked', issueNotLinked(), ErrorCodes.ISSUE_NOT_LINKED, 'This issue is not linked'],
    [
      'issueUnlinkHasUnsentChanges',
      issueUnlinkHasUnsentChanges(),
      ErrorCodes.ISSUE_UNLINK_HAS_UNSENT_CHANGES,
      'This issue has changes not yet sent to GitHub',
    ],
  ])('%s is a 409 with its code and message and no meta', (_name, error, code, message) => {
    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toEqual({ code, message });
  });

  it('githubIssueNotFound is a 404 with its own code', () => {
    const error = githubIssueNotFound();

    expect(error.getStatus()).toBe(404);
    expect(error.getResponse()).toEqual({ code: ErrorCodes.GITHUB_ISSUE_NOT_FOUND, message: 'GitHub issue not found' });
  });

  it('githubIssueAlreadyLinked carries the existing link project and issue uuids', () => {
    const error = githubIssueAlreadyLinked('project-uuid', 'issue-uuid');

    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toEqual({
      code: ErrorCodes.GITHUB_ISSUE_ALREADY_LINKED,
      message: 'This GitHub issue is already linked',
      meta: { projectId: 'project-uuid', issueId: 'issue-uuid' },
    });
  });

  it('issueAttachConfirmationRequired carries differences and updatedAt', () => {
    const error = issueAttachConfirmationRequired(['title', 'state'], '2026-01-01T00:00:00.123Z');

    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toEqual({
      code: ErrorCodes.ISSUE_ATTACH_CONFIRMATION_REQUIRED,
      message: "Attaching replaces this issue's values",
      meta: { differences: ['title', 'state'], updatedAt: '2026-01-01T00:00:00.123Z' },
    });
  });

  it('githubCredentialUnusable carries the reason', () => {
    const error = githubCredentialUnusable('credential_invalid');

    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toEqual({
      code: ErrorCodes.GITHUB_CREDENTIAL_UNUSABLE,
      message: 'The integration for this repository needs attention',
      meta: { reason: 'credential_invalid' },
    });
  });

  it('githubIssueIsPullRequest is a 422', () => {
    const error = githubIssueIsPullRequest();

    expect(error.getStatus()).toBe(422);
    expect(error.getResponse()).toEqual({
      code: ErrorCodes.GITHUB_ISSUE_IS_PULL_REQUEST,
      message: 'This is a pull request, not an issue',
    });
  });

  it('issueLinkRateLimited is a 429 carrying retryAfterSeconds', () => {
    const error = issueLinkRateLimited(7);

    expect(error.getStatus()).toBe(429);
    expect(error.getResponse()).toEqual({
      code: ErrorCodes.ISSUE_LINK_RATE_LIMITED,
      message: 'Too many link requests; try again later',
      retryAfterSeconds: 7,
    });
  });

  it('issueLinkGone is a 409', () => {
    const error = issueLinkGone();

    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toEqual({
      code: ErrorCodes.ISSUE_LINK_GONE,
      message: 'The GitHub issue is no longer available',
    });
  });
});
