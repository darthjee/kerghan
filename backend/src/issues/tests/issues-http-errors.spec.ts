import { ErrorCodes } from '../../core/error-codes.js';
import { repositoryNotFound as addRepositoryNotFound } from '../../repositories/repositories-http-errors.js';
import {
  issueEditRateLimited,
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
});
