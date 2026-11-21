import { Transform } from 'class-transformer';
import { IsInt, IsString, Max, Min } from 'class-validator';
import { MaxCodePoints, trimString } from '../../core/code-points.validator.js';
import type { ListProjectsInput } from '../types/projects-api.types.js';

/** The largest `perPage`. */
export const MAX_PER_PAGE = 100;
/** The longest `search`, after trimming, in code points. */
export const MAX_SEARCH_CODE_POINTS = 100;

/**
 * Request body for `POST /projects.json` (`docs/agents/specs/issues/api/projects.md`). Every field
 * is optional; an absent field takes its default, while an explicit `null` or any invalid value
 * answers `400`. Types are strict (`"1"` is not a number).
 */
export class ListProjectsDto {
  @IsInt()
  @Min(1)
    page: number = 1;

  @IsInt()
  @Min(1)
  @Max(MAX_PER_PAGE)
    perPage: number = 50;

  @Transform(trimString)
  @IsString()
  @MaxCodePoints(MAX_SEARCH_CODE_POINTS)
    search: string = '';
}

/**
 * Maps the validated body to the service input.
 * @param {ListProjectsDto} dto - The validated body.
 * @returns {ListProjectsInput} The listing input.
 */
export function toListProjectsInput(dto: ListProjectsDto): ListProjectsInput {
  return { page: dto.page, perPage: dto.perPage, search: dto.search };
}
