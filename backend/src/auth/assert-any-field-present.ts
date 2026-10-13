import { BadRequestException } from '@nestjs/common';
import { UserFieldChangesDto } from './dto/user-field-changes.dto.js';

/**
 * Rejects a user-update request when none of the updatable fields are
 * present, shared by `AccountService#updateAccount` and
 * `AdminService#editUser` so both self-service and admin edits enforce the
 * same "at least one field" rule.
 * @param {UserFieldChangesDto} dto - The requested changes.
 * @returns {void} Nothing when at least one field is present.
 * @throws {BadRequestException} When `username`, `email`, and `newPassword`
 *   are all absent.
 */
export function assertAnyFieldPresent(dto: UserFieldChangesDto): void {
  if (!dto.username && !dto.email && !dto.newPassword) {
    throw new BadRequestException('At least one of username, email, or newPassword is required');
  }
}

// The default user's fields managed by environment configuration (see
// `docs/agents/specs/default-user/edit-blocking.md`'s "Scope of the block").
const MANAGED_FIELDS = ['username', 'email', 'newPassword'] as const;

/**
 * Reports whether a user-update request carries any field managed by the
 * default-user configuration — by presence, never by value — so
 * `DefaultUserService#assertNotDefaultUser` is applied only to requests that
 * would write a managed field (a future unmanaged field stays editable).
 * @param {UserFieldChangesDto} dto - The requested changes.
 * @returns {boolean} `true` when `username`, `email` or `newPassword` is present.
 */
export function hasManagedField(dto: UserFieldChangesDto): boolean {
  return MANAGED_FIELDS.some((field) => dto[field] !== undefined && dto[field] !== null);
}
