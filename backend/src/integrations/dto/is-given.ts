/**
 * `@ValidateIf` condition for an optional field that, once present, must be
 * valid: skips validation only when the field is absent (`undefined`), so an
 * explicit `null` is still validated (and rejected) instead of being skipped
 * as `@IsOptional()` would.
 * @param {object} _object - The object being validated (unused).
 * @param {unknown} value - The field's value.
 * @returns {boolean} `true` when the field must be validated.
 */
export function isGiven(_object: object, value: unknown): boolean {
  return value !== undefined;
}
