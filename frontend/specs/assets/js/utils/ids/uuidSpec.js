import { isUuid } from '../../../../../assets/js/utils/ids/uuid.js';

describe('isUuid', () => {
  it('accepts a canonical uuid, in any case', () => {
    expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isUuid('AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE')).toBe(true);
  });

  ['', 'abc', '..%2Fadmin', '../admin', '11111111-1111-4111-8111-11111111111', '11111111-1111-4111-8111-1111111111111',
    ' 11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111\n', 'g1111111-1111-4111-8111-111111111111']
    .forEach((value) => {
      it(`rejects ${JSON.stringify(value)}`, () => {
        expect(isUuid(value)).toBe(false);
      });
    });

  it('rejects a non-string', () => {
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(12)).toBe(false);
  });
});
