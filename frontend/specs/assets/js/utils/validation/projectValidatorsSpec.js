import {
  codePointLength, MAX_PROJECT_DESCRIPTION_LENGTH, MAX_PROJECT_NAME_LENGTH, validateProjectDescription,
  validateProjectName,
} from '../../../../../assets/js/utils/validation/projectValidators.js';

describe('projectValidators', () => {
  describe('codePointLength', () => {
    it('counts a 4-byte character once', () => {
      expect(codePointLength('a😀')).toBe(2);
      expect(codePointLength('')).toBe(0);
    });
  });

  describe('validateProjectName', () => {
    it('accepts 1 to 100 trimmed code points', () => {
      expect(validateProjectName('a')).toEqual({});
      expect(validateProjectName('x'.repeat(MAX_PROJECT_NAME_LENGTH))).toEqual({});
      expect(validateProjectName('😀'.repeat(MAX_PROJECT_NAME_LENGTH))).toEqual({});
    });

    it('requires a name, counting only trimmed characters', () => {
      expect(validateProjectName('')).toEqual({ name: 'Name is required' });
      expect(validateProjectName('   ')).toEqual({ name: 'Name is required' });
    });

    it('rejects more than 100 trimmed code points', () => {
      expect(validateProjectName('x'.repeat(101))).toEqual({ name: 'Name must be at most 100 characters' });
      expect(validateProjectName(` ${'x'.repeat(100)} `)).toEqual({});
    });

    it('keys the error under the given field', () => {
      expect(validateProjectName('', 'title')).toEqual({ title: 'Name is required' });
    });
  });

  describe('validateProjectDescription', () => {
    it('accepts an empty description and up to 2000 trimmed code points', () => {
      expect(validateProjectDescription('')).toEqual({});
      expect(validateProjectDescription('x'.repeat(MAX_PROJECT_DESCRIPTION_LENGTH))).toEqual({});
      expect(validateProjectDescription(`  ${'x'.repeat(MAX_PROJECT_DESCRIPTION_LENGTH)}  `)).toEqual({});
    });

    it('rejects more than 2000 code points', () => {
      expect(validateProjectDescription('x'.repeat(2001)))
        .toEqual({ description: 'Description must be at most 2000 characters' });
    });

    it('keys the error under the given field', () => {
      expect(validateProjectDescription('x'.repeat(2001), 'about')).toEqual({
        about: 'Description must be at most 2000 characters',
      });
    });
  });
});
