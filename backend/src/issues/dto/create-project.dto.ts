import { Transform, Type } from 'class-transformer';
import { IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import {
  MAX_DESCRIPTION_CODE_POINTS,
  MAX_NAME_CODE_POINTS,
  normalizeDescription,
} from './project-fields.js';
import { MaxCodePoints, MinCodePoints, trimString } from '../../core/code-points.validator.js';
import { RepoRefDto, toRepoRef } from '../../repositories/repositories.public.js';
import type { CreateProjectInput } from '../types/projects-api.types.js';

/**
 * Request body for `POST /projects/create.json`: `name` (required, trimmed, 1 to 100 code points;
 * blank and `null` rejected), `description` (string or `null`, trimmed, at most 2000 code points)
 * and an optional `repository` ref (absent or `null` makes a non-code project).
 */
export class CreateProjectDto {
  @Transform(trimString)
  @IsString()
  @MinCodePoints(1)
  @MaxCodePoints(MAX_NAME_CODE_POINTS)
    name!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxCodePoints(MAX_DESCRIPTION_CODE_POINTS)
    description?: string | null;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RepoRefDto)
    repository?: RepoRefDto | null;
}

/**
 * Maps the validated body to the service input.
 * @param {CreateProjectDto} dto - The validated body.
 * @returns {CreateProjectInput} The creation input, with a blank description turned into `null`.
 */
export function toCreateProjectInput(dto: CreateProjectDto): CreateProjectInput {
  return {
    name: dto.name,
    description: normalizeDescription(dto.description),
    repository: dto.repository ? toRepoRef(dto.repository) : null,
  };
}
