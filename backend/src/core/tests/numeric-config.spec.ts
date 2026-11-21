import { getNumberConfig, getPositiveIntConfig } from '../numeric-config.js';

/**
 * Builds a minimal fake `ConfigService`, only populating the `get` method `getNumberConfig` reads.
 * @param {unknown} value - The value `get` returns for any key.
 * @returns {{ get: jest.Mock }} The fake config service.
 */
function fakeConfigService(value: unknown): { get: jest.Mock } {
  return { get: jest.fn().mockReturnValue(value) };
}

describe('getNumberConfig', () => {
  it('returns the parsed numeric value when present', () => {
    const configService = fakeConfigService('42');

    expect(getNumberConfig(configService as never, 'SOME_KEY', 7)).toBe(42);
  });

  it('returns the fallback when the value is undefined', () => {
    const configService = fakeConfigService(undefined);

    expect(getNumberConfig(configService as never, 'SOME_KEY', 7)).toBe(7);
  });

  it('returns the fallback when the value is null', () => {
    const configService = fakeConfigService(null);

    expect(getNumberConfig(configService as never, 'SOME_KEY', 7)).toBe(7);
  });

  it('returns the fallback when the value is present but non-numeric (NaN guard)', () => {
    const configService = fakeConfigService('not-a-number');

    expect(getNumberConfig(configService as never, 'SOME_KEY', 7)).toBe(7);
  });
});

describe('getPositiveIntConfig', () => {
  it.each([
    ['unset', undefined],
    ['null', null],
    ['non-numeric', 'abc'],
    ['zero', '0'],
    ['negative', '-5'],
    ['fractional', '1.5'],
  ])('returns the fallback when the value is %s', (_label, value) => {
    expect(getPositiveIntConfig(fakeConfigService(value) as never, 'SOME_KEY', 9)).toBe(9);
  });

  it('returns the parsed value when it is a positive integer', () => {
    expect(getPositiveIntConfig(fakeConfigService('7') as never, 'SOME_KEY', 9)).toBe(7);
  });
});
