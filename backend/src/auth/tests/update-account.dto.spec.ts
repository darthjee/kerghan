import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminUpdateUserDto } from '../dto/admin-update-user.dto.js';
import { UpdateAccountDto } from '../dto/update-account.dto.js';
import { GITHUB_HANDLE_MESSAGE } from '../github-handle.js';

async function check(body: Record<string, unknown>): Promise<{ dto: UpdateAccountDto; errors: string[] }> {
  const dto = plainToInstance(UpdateAccountDto, body);
  const errors = await validate(dto, { whitelist: true });

  return { dto, errors: errors.map((error) => error.property) };
}

describe('UpdateAccountDto', () => {
  describe('githubHandle', () => {
    it.each([
      ['  DarthJee ', 'darthjee'],
      ['@darthjee', 'darthjee'],
      ['@@x', '@x'],
      ['@ x', ' x'],
      ['a-b-c', 'a-b-c'],
    ])('normalises %p to %p before validation', async (input, expected) => {
      const { dto } = await check({ githubHandle: input });

      expect(dto.githubHandle).toBe(expected);
    });

    it.each(['', '   ', '@', ' @ '])('normalises %p to null (clear) and accepts it', async (input) => {
      const { dto, errors } = await check({ githubHandle: input });

      expect(dto.githubHandle).toBeNull();
      expect(errors).toEqual([]);
    });

    it('accepts null (clear)', async () => {
      const { dto, errors } = await check({ githubHandle: null });

      expect(dto.githubHandle).toBeNull();
      expect(errors).toEqual([]);
    });

    it('leaves an absent handle undefined', async () => {
      const { dto, errors } = await check({ username: 'jane', currentPassword: 'secret' });

      expect(dto.githubHandle).toBeUndefined();
      expect(errors).toEqual([]);
    });

    it.each(['a', 'a'.repeat(39), 'a-b', '0abc', 'DarthJee'])('accepts the valid handle %p', async (input) => {
      expect((await check({ githubHandle: input })).errors).toEqual([]);
    });

    it.each(['a'.repeat(40), '-abc', 'abc-', 'a--b', 'a_b', 'a.b', 'a/b', '@@abc', 'a b', 'ä'])(
      'rejects the invalid handle %p with the field message',
      async (input) => {
        const dto = plainToInstance(UpdateAccountDto, { githubHandle: input });
        const errors = await validate(dto);

        expect(errors.map((error) => error.property)).toEqual(['githubHandle']);
        expect(Object.values(errors[0].constraints ?? {})).toContain(GITHUB_HANDLE_MESSAGE);
      },
    );

    it.each([[42], [true], [{ login: 'x' }], [['x']]])('rejects the non-string value %p without coercing it', async (input) => {
      const { dto, errors } = await check({ githubHandle: input });

      expect(dto.githubHandle).toEqual(input);
      expect(errors).toEqual(['githubHandle']);
    });
  });

  describe('managed fields', () => {
    it.each(['username', 'email', 'newPassword'])('rejects null for %s', async (field) => {
      expect((await check({ [field]: null, currentPassword: 'secret' })).errors).toEqual([field]);
    });

    it('keeps the shared validators on the redeclared fields', async () => {
      const { errors } = await check({ username: '', email: 'nope', newPassword: 'short', currentPassword: 'secret' });

      expect(errors.sort()).toEqual(['email', 'newPassword', 'username']);
    });

    it('accepts valid managed fields', async () => {
      const { errors } = await check({
        username: 'jane', email: 'jane@example.com', newPassword: 'long-enough', currentPassword: 'secret',
      });

      expect(errors).toEqual([]);
    });
  });

  describe('currentPassword', () => {
    it('is optional', async () => {
      expect((await check({ githubHandle: 'x' })).errors).toEqual([]);
    });

    it('rejects an empty value when sent', async () => {
      expect((await check({ githubHandle: 'x', currentPassword: '' })).errors).toEqual(['currentPassword']);
    });
  });
});

describe('AdminUpdateUserDto', () => {
  it('still lets null managed fields through as absent', async () => {
    const dto = plainToInstance(AdminUpdateUserDto, { username: null });

    expect(await validate(dto)).toEqual([]);
  });

  it('strips githubHandle under the whitelist', async () => {
    const dto = plainToInstance(AdminUpdateUserDto, { username: 'jane', githubHandle: 'x' });

    expect(await validate(dto, { whitelist: true })).toEqual([]);
    expect((dto as unknown as Record<string, unknown>).githubHandle).toBeUndefined();
  });
});
