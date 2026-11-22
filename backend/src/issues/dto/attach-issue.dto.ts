import { IsISO8601, Matches, ValidateIf } from 'class-validator';
import { IsGithubIssueNumber } from './github-issue-number.js';
import type { AttachIssueInput } from '../types/issues-api.types.js';

// The shape `updatedAt` is answered in: UTC, with milliseconds.
const ISO_UTC_WITH_MILLISECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * Request body for `POST /projects/:projectId/issues/:issueId/attach.json`: `number` is the GitHub
 * issue number; `confirmUpdatedAt` is optional, an ISO 8601 UTC string with milliseconds, as the
 * issue's `updatedAt` is returned. `null` is not accepted: the member is either absent or a valid string.
 */
export class AttachIssueDto {
  @IsGithubIssueNumber()
    number!: number;

  @ValidateIf((_dto: AttachIssueDto, value: unknown) => value !== undefined)
  @Matches(ISO_UTC_WITH_MILLISECONDS)
  @IsISO8601({ strict: true, strictSeparator: true })
    confirmUpdatedAt?: string;
}

/**
 * Maps the validated body to the service input; the confirmation becomes a `Date` (an instant).
 * @param {AttachIssueDto} dto - The validated body.
 * @returns {AttachIssueInput} The attach input; `confirmUpdatedAt` stays absent when not sent.
 */
export function toAttachIssueInput(dto: AttachIssueDto): AttachIssueInput {
  return {
    number: dto.number,
    ...(dto.confirmUpdatedAt === undefined ? {} : { confirmUpdatedAt: new Date(dto.confirmUpdatedAt) }),
  };
}
