import { IsInt, Max, Min } from 'class-validator';

/**
 * The `installationId` field rules: a positive integer below 2^53 (no
 * string coercion). The messages name the field only.
 * @returns {PropertyDecorator} The combined decorators.
 */
export function IsInstallationId(): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    IsInt({ message: 'installationId must be a positive integer' })(target, propertyKey);
    Min(1, { message: 'installationId must be a positive integer' })(target, propertyKey);
    Max(Number.MAX_SAFE_INTEGER, { message: 'installationId must be below 2^53' })(target, propertyKey);
  };
}
