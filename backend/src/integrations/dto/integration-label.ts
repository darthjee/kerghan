import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

// Bounds of a label, after trimming.
export const LABEL_MIN_LENGTH = 1;
export const LABEL_MAX_LENGTH = 100;

/**
 * Trims a string value before validation; leaves anything else for `@IsString()` to reject.
 * @param {{ value: unknown }} params - class-transformer's transform params.
 * @returns {unknown} The trimmed string, or the value unchanged.
 */
export function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * The `label` field rules shared by create and rename: a string, trimmed,
 * 1–100 characters after trimming.
 * @returns {PropertyDecorator} The combined decorators.
 */
export function IsIntegrationLabel(): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    Transform(trimString)(target, propertyKey);
    IsString()(target, propertyKey);
    Length(LABEL_MIN_LENGTH, LABEL_MAX_LENGTH)(target, propertyKey);
  };
}
