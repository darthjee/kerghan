import { plainToInstance, Transform } from 'class-transformer';
import { validate } from 'class-validator';
import { codePointLength, MaxCodePoints, MinCodePoints, trimString } from '../code-points.validator.js';

class Sample {
  @Transform(trimString)
  @MinCodePoints(1)
  @MaxCodePoints(100)
    name?: unknown;
}

async function failures(name: unknown): Promise<string[]> {
  const errors = await validate(plainToInstance(Sample, { name }));

  return errors.flatMap((error) => Object.keys(error.constraints ?? {}));
}

describe('code point validators', () => {
  it('counts an emoji once', () => {
    expect(codePointLength('a😀b')).toBe(3);
    expect('😀'.length).toBe(2);
  });

  it('accepts 100 code points and refuses 101', async () => {
    expect(await failures('a'.repeat(100))).toEqual([]);
    expect(await failures('a'.repeat(101))).toEqual(['maxCodePoints']);
  });

  it('counts 100 emoji as 100 (200 UTF-16 units)', async () => {
    expect(await failures('😀'.repeat(100))).toEqual([]);
    expect(await failures('😀'.repeat(101))).toEqual(['maxCodePoints']);
  });

  it('refuses an empty or blank value through the minimum, after trimming', async () => {
    expect(await failures('')).toEqual(['minCodePoints']);
    expect(await failures('   ')).toEqual(['minCodePoints']);
  });

  it.each([[42], [null], [undefined], [['a']]])('refuses the non-string %p', async (value) => {
    expect((await failures(value)).length).toBeGreaterThan(0);
  });

  it('trims strings and leaves other values alone', () => {
    expect(trimString({ value: '  x ' })).toBe('x');
    expect(trimString({ value: 5 })).toBe(5);
  });
});
