import { BadRequestException } from '@nestjs/common';
import { UserFieldChangesDto } from './dto/user-field-changes.dto.js';

/** Every field an edit request may count as "present". */
export interface EditableFields extends UserFieldChangesDto {
  githubHandle?: string | null;
}

/** A caller's "at least one field" rule: which fields count, and the refusal message. */
export interface FieldPresenceRule {
  fields: readonly (keyof EditableFields)[];
  message: string;
}

/**
 * `PATCH /auth/account.json`'s rule: the managed fields plus `githubHandle`.
 */
export const ACCOUNT_EDIT_FIELDS: FieldPresenceRule = {
  fields: ['username', 'email', 'newPassword', 'githubHandle'],
  message: 'At least one of username, email, newPassword or githubHandle is required',
};

/**
 * `POST /admin/users/:id/edit.json`'s rule: the managed fields only, with the
 * admin route's historical message, so admins never see `githubHandle` named.
 */
export const ADMIN_EDIT_FIELDS: FieldPresenceRule = {
  fields: ['username', 'email', 'newPassword'],
  message: 'At least one of username, email, or newPassword is required',
};

// Fields where `null` is a meaningful value ("clear"), so presence is "the
// key is in the body" rather than "a non-empty value was sent".
const CLEARABLE_FIELDS: readonly (keyof EditableFields)[] = ['githubHandle'];

// The default user's fields managed by environment configuration (see
// `docs/agents/specs/default-user/edit-blocking.md`'s "Scope of the block").
const MANAGED_FIELDS = ['username', 'email', 'newPassword'] as const;

/**
 * Rejects a user-update request when none of the caller's counted fields is
 * present, shared by `AccountService#updateAccount` and
 * `AdminService#editUser`, each passing its own rule. A clearable field
 * (`githubHandle`) counts whenever its key is set, `null` included; any other
 * field counts only with a non-empty value.
 * @param {EditableFields} dto - The requested changes.
 * @param {FieldPresenceRule} rule - The fields that count, and the message.
 * @returns {void} Nothing when at least one counted field is present.
 * @throws {BadRequestException} When every counted field is absent.
 */
export function assertAnyFieldPresent(dto: EditableFields, rule: FieldPresenceRule): void {
  if (!rule.fields.some((field) => isFieldPresent(dto, field))) {
    throw new BadRequestException(rule.message);
  }
}

/**
 * Reports whether a user-update request carries any field managed by the
 * default-user configuration — by presence, never by value — so
 * `DefaultUserService#assertNotDefaultUser` is applied only to requests that
 * would write a managed field (an unmanaged field such as `githubHandle`
 * stays editable).
 * @param {UserFieldChangesDto} dto - The requested changes.
 * @returns {boolean} `true` when `username`, `email` or `newPassword` is present.
 */
export function hasManagedField(dto: UserFieldChangesDto): boolean {
  return MANAGED_FIELDS.some((field) => dto[field] !== undefined && dto[field] !== null);
}

/**
 * @param {EditableFields} dto - The requested changes.
 * @param {keyof EditableFields} field - The field to check.
 * @returns {boolean} Whether the field counts as present.
 */
function isFieldPresent(dto: EditableFields, field: keyof EditableFields): boolean {
  if (CLEARABLE_FIELDS.includes(field)) {
    return dto[field] !== undefined;
  }

  return Boolean(dto[field]);
}
