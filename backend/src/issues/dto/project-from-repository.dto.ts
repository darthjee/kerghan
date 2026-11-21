import { Transform, Type } from 'class-transformer';
import { IsDefined, IsObject, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';
import {
  MAX_DESCRIPTION_CODE_POINTS,
  MAX_NAME_CODE_POINTS,
  normalizeDescription,
} from './project-fields.js';
import { MaxCodePoints, MinCodePoints, trimString } from '../../core/code-points.validator.js';
import { RepoRefDto, toRepoRef } from '../../repositories/repositories.public.js';
import type { ProjectFromRepositoryInput } from '../types/projects-api.types.js';

/**
 * Request body for `POST /projects/from-repository.json` (the shortcut): `repository` is required
 * and non-null; `name` is optional (`null` rejected; the default is `owner/name`); `description`
 * follows the create rules.
 */
export class ProjectFromRepositoryDto {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => RepoRefDto)
    repository!: RepoRefDto;

  @ValidateIf((_dto: ProjectFromRepositoryDto, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MinCodePoints(1)
  @MaxCodePoints(MAX_NAME_CODE_POINTS)
    name?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxCodePoints(MAX_DESCRIPTION_CODE_POINTS)
    description?: string | null;
}

/**
 * Maps the validated body to the service input.
 * @param {ProjectFromRepositoryDto} dto - The validated body.
 * @returns {ProjectFromRepositoryInput} The shortcut input.
 */
export function toProjectFromRepositoryInput(dto: ProjectFromRepositoryDto): ProjectFromRepositoryInput {
  return {
    repository: toRepoRef(dto.repository),
    ...(dto.name === undefined ? {} : { name: dto.name }),
    description: normalizeDescription(dto.description),
  };
}
