import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsString, IsUUID, ValidateBy } from 'class-validator';
import type { IssueState } from '../entities/issue.entity.js';
import type { BulkIssueStateInput } from '../types/issues-api.types.js';

/** The most ids one bulk request may carry. */
export const MAX_BULK_ISSUE_IDS = 100;

/**
 * Fails unless the value is an array whose strings are all distinct once lowercased. Anything that
 * is not an array, and non-string items, are left for the other validators to reject.
 * @returns {PropertyDecorator} The decorator.
 */
function NoCaseInsensitiveDuplicates(): PropertyDecorator {
  return ValidateBy({
    name: 'noCaseInsensitiveDuplicates',
    validator: {
      validate: (value: unknown): boolean => {
        if (!Array.isArray(value)) {
          return true;
        }
        const lowered = value.map((item: unknown) => (typeof item === 'string' ? item.toLowerCase() : item));

        return new Set(lowered).size === lowered.length;
      },
      defaultMessage: (): string => '$property must not contain duplicate ids',
    },
  });
}

/**
 * Request body for `POST /projects/:projectId/issues/bulk-state.json`: `issueIds` (required, 1 to
 * 100 uuids, no case-insensitive duplicates) and `state` (required, `open` or `closed`).
 */
export class BulkIssueStateDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK_ISSUE_IDS)
  @IsString({ each: true })
  @IsUUID('all', { each: true })
  @NoCaseInsensitiveDuplicates()
    issueIds!: string[];

  @IsIn(['open', 'closed'])
    state!: IssueState;
}

/**
 * Maps the validated body to the service input; the ids are lowercased and keep the request order.
 * @param {BulkIssueStateDto} dto - The validated body.
 * @returns {BulkIssueStateInput} The bulk input.
 */
export function toBulkIssueStateInput(dto: BulkIssueStateDto): BulkIssueStateInput {
  return { issueIds: dto.issueIds.map((id) => id.toLowerCase()), state: dto.state };
}
