import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import {
  MAX_BODY_CODE_POINTS,
  MAX_TITLE_CODE_POINTS,
  normalizeBody,
} from './issue-fields.js';
import { MaxCodePoints, MinCodePoints, trimString } from '../../core/code-points.validator.js';
import type { IssueState } from '../entities/issue.entity.js';
import type { CreateIssueInput } from '../types/issues-api.types.js';

/**
 * Request body for `POST /projects/:projectId/issues/create.json`: `title` (required, trimmed,
 * 1 to 256 code points), `body` (string or `null`, at most 65536 code points, never trimmed) and
 * `state` (`open` or `closed`, default `open`).
 */
export class CreateIssueDto {
  @Transform(trimString)
  @IsString()
  @MinCodePoints(1)
  @MaxCodePoints(MAX_TITLE_CODE_POINTS)
    title!: string;

  @IsOptional()
  @IsString()
  @MaxCodePoints(MAX_BODY_CODE_POINTS)
    body?: string | null;

  @IsIn(['open', 'closed'])
    state: IssueState = 'open';
}

/**
 * Maps the validated body to the service input.
 * @param {CreateIssueDto} dto - The validated body.
 * @returns {CreateIssueInput} The creation input, with an empty body turned into `null`.
 */
export function toCreateIssueInput(dto: CreateIssueDto): CreateIssueInput {
  return { title: dto.title, body: normalizeBody(dto.body), state: dto.state };
}
