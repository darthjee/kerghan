import { IsInt, IsString, Matches, Max, Min, registerDecorator, ValidateIf } from 'class-validator';
import type { RepoRef } from '../types/repositories-api.types.js';

/**
 * `owner/name`: the owner follows the GitHub handle rule (letters, digits,
 * single hyphens, no leading or trailing hyphen, at most 39 characters); the
 * name is `[A-Za-z0-9._-]{1,100}`, neither `.` nor `..`.
 */
export const FULL_NAME_FORMAT = /^(?!-)(?!.*--)[A-Za-z0-9-]{1,39}(?<!-)\/(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/;

const EXACTLY_ONE_MESSAGE = 'exactly one of githubId or fullName must be given';

/** The two ref fields, as read off the object being validated. */
interface RefFields {
  githubId?: unknown;
  fullName?: unknown;
}

/**
 * Whether exactly one of `githubId` / `fullName` is present.
 * @param {RefFields} ref - The object being validated.
 * @returns {boolean} `true` when exactly one is given.
 */
export function hasExactlyOneRef(ref: RefFields): boolean {
  return (ref.githubId !== undefined) !== (ref.fullName !== undefined);
}

/**
 * Fails unless exactly one of `githubId` / `fullName` is present.
 * @returns {PropertyDecorator} The decorator.
 */
function IsExactlyOneRef(): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    registerDecorator({
      name: 'isExactlyOneRef',
      target: target.constructor,
      propertyName: String(propertyKey),
      options: { message: EXACTLY_ONE_MESSAGE },
      validator: { validate: (_value: unknown, args) => hasExactlyOneRef(args?.object as RefFields) },
    });
  };
}

/**
 * Request body for `POST /repositories/add.json`: a repo ref
 * (`api.md#repo-ref`), exactly one of `githubId` (a positive safe integer)
 * or `fullName` (`owner/name`). Both or neither answers `400`. `githubId` is
 * validated also when both are absent, so "neither" fails there.
 */
export class RepoRefDto {
  @ValidateIf((dto: RepoRefDto) => dto.githubId !== undefined || dto.fullName === undefined)
  @IsExactlyOneRef()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
    githubId?: number;

  @ValidateIf((dto: RepoRefDto) => dto.fullName !== undefined)
  @IsExactlyOneRef()
  @IsString()
  @Matches(FULL_NAME_FORMAT, { message: 'fullName must be owner/name' })
    fullName?: string;
}

/**
 * Maps the validated body to the service's repo ref.
 * @param {RepoRefDto} dto - The validated body (exactly one field set).
 * @returns {RepoRef} The ref.
 */
export function toRepoRef(dto: RepoRefDto): RepoRef {
  return dto.githubId === undefined ? { fullName: dto.fullName as string } : { githubId: dto.githubId };
}
