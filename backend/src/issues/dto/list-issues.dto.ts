import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsString, Max, Min } from 'class-validator';
import { MAX_PER_PAGE, MAX_SEARCH_CODE_POINTS } from './list-projects.dto.js';
import { MaxCodePoints, trimString } from '../../core/code-points.validator.js';
import type { IssueStateFilter, ListIssuesInput } from '../types/issues-api.types.js';

/**
 * Request body for `POST /projects/:projectId/issues.json` (`docs/agents/backend/routes/issues/issues.md`).
 * Every field is optional; an absent field takes its default, while an explicit `null` or any
 * invalid value answers `400`. Types are strict (`"1"` is not a number).
 */
export class ListIssuesDto {
  @IsInt()
  @Min(1)
    page: number = 1;

  @IsInt()
  @Min(1)
  @Max(MAX_PER_PAGE)
    perPage: number = 50;

  @IsIn(['open', 'closed', 'all'])
    state: IssueStateFilter = 'open';

  @Transform(trimString)
  @IsString()
  @MaxCodePoints(MAX_SEARCH_CODE_POINTS)
    search: string = '';
}

/**
 * Maps the validated body to the service input.
 * @param {ListIssuesDto} dto - The validated body.
 * @returns {ListIssuesInput} The listing input.
 */
export function toListIssuesInput(dto: ListIssuesDto): ListIssuesInput {
  return { page: dto.page, perPage: dto.perPage, state: dto.state, search: dto.search };
}
