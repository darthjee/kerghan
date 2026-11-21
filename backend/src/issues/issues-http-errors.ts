import { NotFoundException } from '@nestjs/common';

// One message for a missing, foreign or deleted project, so existence never leaks.
export const PROJECT_NOT_FOUND_MESSAGE = 'Project not found';
// One message for a missing issue or one that belongs to another project.
export const ISSUE_NOT_FOUND_MESSAGE = 'Issue not found';

/**
 * 404 `NOT_FOUND`: the single answer for a project that is missing, another user's or deleted,
 * so every body is byte-identical (`docs/agents/specs/issues/api/errors-and-validation.md`).
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
