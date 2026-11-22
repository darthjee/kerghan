import { IsBoolean, ValidateIf } from 'class-validator';
import type { UnlinkIssueInput } from '../types/issues-api.types.js';

/**
 * Request body for `POST /projects/:projectId/issues/:issueId/unlink.json`: `discardUnsentChanges`
 * is an optional strict boolean; only `true` discards.
 */
export class UnlinkIssueDto {
  @ValidateIf((_dto: UnlinkIssueDto, value: unknown) => value !== undefined)
  @IsBoolean()
    discardUnsentChanges?: boolean;
}

/**
 * Maps the validated body to the service input.
 * @param {UnlinkIssueDto} dto - The validated body.
 * @returns {UnlinkIssueInput} The unlink input; anything but `true` does not discard.
 */
export function toUnlinkIssueInput(dto: UnlinkIssueDto): UnlinkIssueInput {
  return { discardUnsentChanges: dto.discardUnsentChanges === true };
}
