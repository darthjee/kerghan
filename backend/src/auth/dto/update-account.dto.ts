import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  GITHUB_HANDLE_FORMAT,
  GITHUB_HANDLE_MESSAGE,
  normalizeGithubHandle,
} from '../github-handle.js';
import { PASSWORD_MIN_LENGTH } from '../password-rules.js';
import { UserFieldChangesDto } from './user-field-changes.dto.js';

/**
 * Normalises `githubHandle` before validation. Only strings are normalised:
 * `null` stays `null` (clear) and any other type is passed through untouched,
 * so `@IsString()` rejects it instead of it being coerced into a string.
 * @param {{ value: unknown }} params - class-transformer's transform params.
 * @returns {unknown} The normalised handle, or the original value.
 */
function normalizeHandleValue({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? normalizeGithubHandle(value) : value;
}

/**
 * Request body for `PATCH /auth/account.json`. At least one of `username`,
 * `email`, `newPassword` or `githubHandle` must be present — that rule is
 * business logic enforced by `AccountService`, not a per-field decorator
 * here. `currentPassword` is required only when a managed field (`username`,
 * `email`, `newPassword`) is present, which `AccountService` also enforces.
 *
 * The managed fields are redeclared here with `@ValidateIf(... !== undefined)`
 * instead of the shared `@IsOptional()`, so `null` for any of them answers
 * `400` on this route only (`AdminUpdateUserDto` keeps the shared block).
 * Only `githubHandle` accepts `null`, meaning clear; it lives on this DTO
 * only, so the admin contract never names it.
 *
 * No `newPasswordConfirmation` field — matching `RegisterDto`/
 * `ResetPasswordDto`, password confirmation equality is a client-only UX
 * check. The session to keep on a password change is identified by the
 * `refresh_token` cookie, not by a body field.
 */
export class UpdateAccountDto extends UserFieldChangesDto {
  @ValidateIf((dto: UpdateAccountDto) => dto.username !== undefined)
  @IsString()
  @IsNotEmpty()
    username?: string;

  @ValidateIf((dto: UpdateAccountDto) => dto.email !== undefined)
  @IsEmail()
    email?: string;

  @ValidateIf((dto: UpdateAccountDto) => dto.newPassword !== undefined)
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
    newPassword?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
    currentPassword?: string;

  @Transform(normalizeHandleValue)
  @ValidateIf((dto: UpdateAccountDto) => dto.githubHandle !== undefined && dto.githubHandle !== null)
  @IsString({ message: GITHUB_HANDLE_MESSAGE })
  @Matches(GITHUB_HANDLE_FORMAT, { message: GITHUB_HANDLE_MESSAGE })
    githubHandle?: string | null;
}
