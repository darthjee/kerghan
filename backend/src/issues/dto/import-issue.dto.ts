import { IsGithubIssueNumber } from './github-issue-number.js';
import type { ImportIssueInput } from '../types/issues-api.types.js';

/**
 * Request body for `POST /projects/:projectId/issues/import.json`: `number` is the GitHub issue
 * number, a required integer from 1 to 2147483647.
 */
export class ImportIssueDto {
  @IsGithubIssueNumber()
    number!: number;
}

/**
 * Maps the validated body to the service input.
 * @param {ImportIssueDto} dto - The validated body.
 * @returns {ImportIssueInput} The import input.
 */
export function toImportIssueInput(dto: ImportIssueDto): ImportIssueInput {
  return { number: dto.number };
}
