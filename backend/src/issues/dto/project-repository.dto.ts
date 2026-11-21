import { Type } from 'class-transformer';
import { IsDefined, IsObject, ValidateIf, ValidateNested } from 'class-validator';
import { RepoRefDto, toRepoRef } from '../../repositories/repositories.public.js';
import type { ProjectRepositoryInput } from '../types/projects-api.types.js';

/**
 * Request body for `POST /projects/:projectId/repository.json`: `repository` is required; a ref
 * connects or changes it and `null` detaches. An absent key is `400`.
 */
export class ProjectRepositoryDto {
  @IsDefined()
  @ValidateIf((dto: ProjectRepositoryDto) => dto.repository !== null)
  @IsObject()
  @ValidateNested()
  @Type(() => RepoRefDto)
    repository!: RepoRefDto | null;
}

/**
 * Maps the validated body to the service input.
 * @param {ProjectRepositoryDto} dto - The validated body.
 * @returns {ProjectRepositoryInput} The repository input (`null` detaches).
 */
export function toProjectRepositoryInput(dto: ProjectRepositoryDto): ProjectRepositoryInput {
  return { repository: dto.repository === null ? null : toRepoRef(dto.repository) };
}
