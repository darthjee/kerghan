import { BadRequestException } from '@nestjs/common';

/**
 * Fields shared by `UpdateAccountDto` and `AdminUpdateUserDto`, the two DTOs
 * this validation applies to.
 */
interface FieldsDto {
  username?: string;
  email?: string;
  newPassword?: string;
}

/**
 * Rejects a user-update request when none of the updatable fields are
 * present, shared by `AccountService#updateAccount` and
 * `AdminService#editUser` so both self-service and admin edits enforce the
 * same "at least one field" rule.
 * @param {FieldsDto} dto - The requested changes.
 * @returns {void} Nothing when at least one field is present.
 * @throws {BadRequestException} When `username`, `email`, and `newPassword`
 *   are all absent.
 */
export function assertAnyFieldPresent(dto: FieldsDto): void {
  if (!dto.username && !dto.email && !dto.newPassword) {
    throw new BadRequestException('At least one of username, email, or newPassword is required');
  }
}
