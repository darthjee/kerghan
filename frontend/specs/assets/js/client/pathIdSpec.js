import ApiError from '../../../../assets/js/client/ApiError.js';
import pathId from '../../../../assets/js/client/pathId.js';

describe('pathId', () => {
  it('returns a uuid unchanged', () => {
    expect(pathId('11111111-1111-4111-8111-111111111111')).toBe('11111111-1111-4111-8111-111111111111');
  });

  ['..%2Fadmin', '../admin', 'abc', '', undefined].forEach((value) => {
    it(`throws a 404-shaped ApiError for ${JSON.stringify(value)}`, () => {
      expect(() => pathId(value)).toThrow(jasmine.any(ApiError));
      expect(() => pathId(value)).toThrow(jasmine.objectContaining({ status: 404, code: 'NOT_FOUND' }));
    });
  });
});
