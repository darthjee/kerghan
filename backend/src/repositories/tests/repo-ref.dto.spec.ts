import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FULL_NAME_FORMAT, RepoRefDto, toRepoRef } from '../dto/repo-ref.dto.js';

async function check(body: Record<string, unknown>): Promise<{ dto: RepoRefDto; errors: string[] }> {
  const dto = plainToInstance(RepoRefDto, body);
  const errors = await validate(dto, { whitelist: true });

  return { dto, errors: errors.map((error) => error.property) };
}

describe('RepoRefDto', () => {
  describe('exactly one of githubId / fullName', () => {
    it('rejects neither', async () => {
      expect((await check({})).errors).toEqual(['githubId']);
    });

    it('rejects both', async () => {
      expect((await check({ githubId: 1, fullName: 'octo/x' })).errors).toEqual(['githubId', 'fullName']);
    });

    it('accepts githubId alone and fullName alone', async () => {
      expect((await check({ githubId: 1 })).errors).toEqual([]);
      expect((await check({ fullName: 'octo/x' })).errors).toEqual([]);
    });

    it('strips unknown properties', async () => {
      const { dto, errors } = await check({ githubId: 5, id: 99, userId: 3 });

      expect(errors).toEqual([]);
      expect(toRepoRef(dto)).toEqual({ githubId: 5 });
    });
  });

  describe('githubId', () => {
    it.each([1, 123_456, Number.MAX_SAFE_INTEGER])('accepts %p', async (githubId) => {
      expect((await check({ githubId })).errors).toEqual([]);
    });

    it.each([
      ['zero', 0],
      ['negative', -3],
      ['fractional', 1.5],
      ['above MAX_SAFE_INTEGER', Number.MAX_SAFE_INTEGER + 2],
      ['1e300', 1e300],
      ['a string', '123'],
      ['null', null],
    ])('rejects %s', async (_label, githubId) => {
      expect((await check({ githubId })).errors).toEqual(['githubId']);
    });
  });

  describe('fullName', () => {
    it.each([
      'darthjee/kerghan',
      'DarthJee/Kerghan',
      'a-b/c',
      'octo/.github',
      'octo/x.json',
      'octo/a_b-c.d',
      'octo/...',
      `${'a'.repeat(39)}/${'b'.repeat(100)}`,
    ])('accepts %p', async (fullName) => {
      expect((await check({ fullName })).errors).toEqual([]);
    });

    it.each([
      ['no slash', 'darthjee'],
      ['two slashes', 'a/b/c'],
      ['name "."', 'octo/.'],
      ['name ".."', 'octo/..'],
      ['empty owner', '/x'],
      ['empty name', 'octo/'],
      ['owner with --', 'a--b/x'],
      ['leading hyphen', '-ab/x'],
      ['trailing hyphen', 'ab-/x'],
      ['owner over 39', `${'a'.repeat(40)}/x`],
      ['name over 100', `octo/${'b'.repeat(101)}`],
      ['owner with a dot', 'a.b/x'],
      ['name with a space', 'octo/a b'],
      ['a number', 42],
      ['null', null],
    ])('rejects %s', async (_label, fullName) => {
      expect((await check({ fullName })).errors).toEqual(['fullName']);
    });

    it('exposes the format', () => {
      expect(FULL_NAME_FORMAT.test('octo/x')).toBe(true);
    });
  });

  describe('toRepoRef', () => {
    it('maps a fullName ref', async () => {
      expect(toRepoRef((await check({ fullName: 'octo/x' })).dto)).toEqual({ fullName: 'octo/x' });
    });
  });
});
