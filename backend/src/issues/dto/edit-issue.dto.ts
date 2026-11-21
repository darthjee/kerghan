import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';
import {
  MAX_BODY_CODE_POINTS,
  MAX_TITLE_CODE_POINTS,
  normalizeBody,
} from './issue-fields.js';
import { MaxCodePoints, MinCodePoints, trimString } from '../../core/code-points.validator.js';
import type { IssueState } from '../entities/issue.entity.js';
import type { EditIssueInput } from '../types/issues-api.types.js';

/**
 * Request body for `POST /projects/:projectId/issues/:issueId/edit.json`: `title` and `state` are
 * optional (`null` rejected); `body` is optional, and `null` or `''` clears it.
 */
export class EditIssueDto {
  @ValidateIf((_dto: EditIssueDto, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MinCodePoints(1)
  @MaxCodePoints(MAX_TITLE_CODE_POINTS)
    title?: string;

  @IsOptional()
  @IsString()
  @MaxCodePoints(MAX_BODY_CODE_POINTS)
    body?: string | null;

  @ValidateIf((_dto: EditIssueDto, value: unknown) => value !== undefined)
  @IsIn(['open', 'closed'])
    state?: IssueState;
}

/**
 * Maps the validated body to the service input; an absent member stays absent.
 * @param {EditIssueDto} dto - The validated body.
 * @returns {EditIssueInput} The edit input.
 */
export function toEditIssueInput(dto: EditIssueDto): EditIssueInput {
  return {
    ...(dto.title === undefined ? {} : { title: dto.title }),
    ...(dto.body === undefined ? {} : { body: normalizeBody(dto.body) }),
    ...(dto.state === undefined ? {} : { state: dto.state }),
  };
}
