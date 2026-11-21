import { Transform } from 'class-transformer';
import { IsOptional, IsString, ValidateIf } from 'class-validator';
import {
  MAX_DESCRIPTION_CODE_POINTS,
  MAX_NAME_CODE_POINTS,
  normalizeDescription,
} from './project-fields.js';
import { MaxCodePoints, MinCodePoints, trimString } from '../../core/code-points.validator.js';
import type { EditProjectInput } from '../types/projects-api.types.js';

/**
 * Request body for `POST /projects/:projectId/edit.json`: `name` is optional (`null` rejected);
 * `description` is optional, and `null` or blank clears it.
 */
export class EditProjectDto {
  @ValidateIf((_dto: EditProjectDto, value: unknown) => value !== undefined)
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
 * Maps the validated body to the service input; an absent member stays absent.
 * @param {EditProjectDto} dto - The validated body.
 * @returns {EditProjectInput} The edit input.
 */
export function toEditProjectInput(dto: EditProjectDto): EditProjectInput {
  return {
    ...(dto.name === undefined ? {} : { name: dto.name }),
    ...(dto.description === undefined ? {} : { description: normalizeDescription(dto.description) }),
  };
}
