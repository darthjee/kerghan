import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import type { ListFilter, ListInput } from '../types/repositories-api.types.js';

/** The accepted `filter` values (`unknown` is rejected on purpose). */
export const LIST_FILTERS: readonly ListFilter[] = ['all', 'added', 'not_added', 'unavailable'];
/** The largest `perPage`. */
export const MAX_PER_PAGE = 100;
/** The longest `search`, after trimming. */
export const MAX_SEARCH_LENGTH = 100;

/**
 * Trims a string value before validation; leaves anything else for `@IsString()` to reject.
 * @param {{ value: unknown }} params - class-transformer's transform params.
 * @returns {unknown} The trimmed string, or the value unchanged.
 */
function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * Request body for `POST /repositories/mine.json` (`docs/agents/backend/routes/repositories.md#request`). Every
 * field is optional; an absent field takes its default, while an explicit
 * `null` or any invalid value answers `400`.
 */
export class ListRepositoriesDto {
  @IsInt()
  @Min(1)
    page: number = 1;

  @IsInt()
  @Min(1)
  @Max(MAX_PER_PAGE)
    perPage: number = 50;

  @IsIn(LIST_FILTERS)
    filter: ListFilter = 'all';

  @Transform(trimString)
  @IsString()
  @MaxLength(MAX_SEARCH_LENGTH)
    search: string = '';
}

/**
 * Maps the validated body to the service input.
 * @param {ListRepositoriesDto} dto - The validated body.
 * @returns {ListInput} The listing input.
 */
export function toListInput(dto: ListRepositoriesDto): ListInput {
  return { page: dto.page, perPage: dto.perPage, filter: dto.filter, search: dto.search };
}
