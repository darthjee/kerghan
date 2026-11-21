import { ValidateBy, type ValidationOptions } from 'class-validator';

/**
 * Counts Unicode code points, so a 4-byte character (an emoji) counts once, matching MySQL's
 * `varchar` under utf8mb4. class-validator's `MaxLength` counts UTF-16 units (an emoji counts twice).
 * @param {string} value - The string to measure.
 * @returns {number} The number of code points.
 */
export function codePointLength(value: string): number {
  return [...value].length;
}

/**
 * Fails unless the value is a string of at most `max` code points.
 * @param {number} max - The inclusive upper bound.
 * @param {ValidationOptions} [options] - Extra class-validator options.
 * @returns {PropertyDecorator} The decorator.
 */
export function MaxCodePoints(max: number, options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'maxCodePoints',
      constraints: [max],
      validator: {
        validate: (value: unknown): boolean => typeof value === 'string' && codePointLength(value) <= max,
        defaultMessage: (): string => `$property must be shorter than or equal to ${max} characters`,
      },
    },
    options,
  );
}

/**
 * Fails unless the value is a string of at least `min` code points.
 * @param {number} min - The inclusive lower bound.
 * @param {ValidationOptions} [options] - Extra class-validator options.
 * @returns {PropertyDecorator} The decorator.
 */
export function MinCodePoints(min: number, options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'minCodePoints',
      constraints: [min],
      validator: {
        validate: (value: unknown): boolean => typeof value === 'string' && codePointLength(value) >= min,
        defaultMessage: (): string => `$property must be longer than or equal to ${min} characters`,
      },
    },
    options,
  );
}

/**
 * Trims a string value before validation; leaves anything else for `@IsString()` to reject.
 * @param {{ value: unknown }} params - class-transformer's transform params.
 * @returns {unknown} The trimmed string, or the value unchanged.
 */
export function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
