import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListRepositoriesDto, toListInput } from '../dto/list-repositories.dto.js';

async function check(body: Record<string, unknown>): Promise<{ dto: ListRepositoriesDto; errors: string[] }> {
  const dto = plainToInstance(ListRepositoriesDto, body);
  const errors = await validate(dto, { whitelist: true });

  return { dto, errors: errors.map((error) => error.property) };
}

describe('ListRepositoriesDto', () => {
  it('applies the defaults to an empty body', async () => {
    const { dto, errors } = await check({});

    expect(errors).toEqual([]);
    expect(toListInput(dto)).toEqual({ page: 1, perPage: 50, filter: 'all', search: '' });
  });

  it('strips unknown properties', async () => {
    const { dto, errors } = await check({ page: 2, sort: 'name', userId: 9 });

    expect(errors).toEqual([]);
    expect(toListInput(dto)).toEqual({ page: 2, perPage: 50, filter: 'all', search: '' });
  });

  it.each([
    [{ page: 3 }],
    [{ perPage: 1 }],
    [{ perPage: 100 }],
    [{ filter: 'added' }],
    [{ filter: 'not_added' }],
    [{ filter: 'unavailable' }],
    [{ search: 'a'.repeat(100) }],
    [{ search: '' }],
  ])('accepts %p', async (body) => {
    expect((await check(body)).errors).toEqual([]);
  });

  it.each([
    ['page 0', { page: 0 }, 'page'],
    ['page fractional', { page: 1.5 }, 'page'],
    ['page string', { page: '2' }, 'page'],
    ['page null', { page: null }, 'page'],
    ['perPage 0', { perPage: 0 }, 'perPage'],
    ['perPage over 100', { perPage: 101 }, 'perPage'],
    ['filter unknown', { filter: 'unknown' }, 'filter'],
    ['filter other', { filter: 'private' }, 'filter'],
    ['search over 100', { search: 'a'.repeat(101) }, 'search'],
    ['search not a string', { search: 5 }, 'search'],
    ['search null', { search: null }, 'search'],
  ])('rejects %s', async (_label, body, property) => {
    expect((await check(body)).errors).toEqual([property]);
  });

  it('trims search before the length check', async () => {
    const { dto, errors } = await check({ search: `  ${'a'.repeat(100)}  ` });

    expect(errors).toEqual([]);
    expect(dto.search).toBe('a'.repeat(100));
  });

  it('keeps LIKE metacharacters as given (escaped by the query)', async () => {
    expect((await check({ search: ' 50%_\\ ' })).dto.search).toBe('50%_\\');
  });
});
