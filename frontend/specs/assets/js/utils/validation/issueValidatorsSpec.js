import {
  MAX_ISSUE_BODY_LENGTH, MAX_ISSUE_TITLE_LENGTH, validateIssueBody, validateIssueTitle,
} from '../../../../../assets/js/utils/validation/issueValidators.js';

describe('issueValidators', () => {
  describe('validateIssueTitle', () => {
    it('accepts 1 to 256 trimmed code points', () => {
      expect(validateIssueTitle('a')).toEqual({});
      expect(validateIssueTitle('x'.repeat(MAX_ISSUE_TITLE_LENGTH))).toEqual({});
      expect(validateIssueTitle('😀'.repeat(MAX_ISSUE_TITLE_LENGTH))).toEqual({});
      expect(validateIssueTitle(` ${'x'.repeat(MAX_ISSUE_TITLE_LENGTH)} `)).toEqual({});
    });

    it('requires a title, counting only trimmed characters', () => {
      expect(validateIssueTitle('')).toEqual({ title: 'Title is required' });
      expect(validateIssueTitle('   ')).toEqual({ title: 'Title is required' });
    });

    it('rejects more than 256 trimmed code points', () => {
      expect(validateIssueTitle('x'.repeat(257))).toEqual({ title: 'Title must be at most 256 characters' });
    });

    it('keys the error under the given field', () => {
      expect(validateIssueTitle('', 'name')).toEqual({ name: 'Title is required' });
    });
  });

  describe('validateIssueBody', () => {
    it('accepts an empty body and up to 65536 code points', () => {
      expect(validateIssueBody('')).toEqual({});
      expect(validateIssueBody('x'.repeat(MAX_ISSUE_BODY_LENGTH))).toEqual({});
      expect(validateIssueBody('😀'.repeat(MAX_ISSUE_BODY_LENGTH))).toEqual({});
    });

    it('never trims the body', () => {
      expect(validateIssueBody(`${' '.repeat(MAX_ISSUE_BODY_LENGTH)}x`))
        .toEqual({ body: 'Body must be at most 65536 characters' });
    });

    it('rejects more than 65536 code points', () => {
      expect(validateIssueBody('x'.repeat(MAX_ISSUE_BODY_LENGTH + 1)))
        .toEqual({ body: 'Body must be at most 65536 characters' });
    });
  });
});
