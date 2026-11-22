import { IsInt, Max, Min } from 'class-validator';

/** The largest GitHub issue number the link accepts (a signed 32-bit integer). */
export const MAX_GITHUB_ISSUE_NUMBER = 2_147_483_647;

/**
 * The strict validation of a GitHub issue number: an integer from 1 to 2147483647. Nothing is
 * coerced, so `"12"`, `1.5`, `0` and `null` are rejected.
 * @returns {PropertyDecorator} The combined decorator.
 */
export function IsGithubIssueNumber(): PropertyDecorator {
  return (target, propertyKey) => {
    IsInt()(target, propertyKey);
    Min(1)(target, propertyKey);
    Max(MAX_GITHUB_ISSUE_NUMBER)(target, propertyKey);
  };
}
