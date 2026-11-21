import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProjectDto, toCreateProjectInput } from '../dto/create-project.dto.js';
import { EditProjectDto, toEditProjectInput } from '../dto/edit-project.dto.js';
import { ListProjectsDto, toListProjectsInput } from '../dto/list-projects.dto.js';
import { ProjectFromRepositoryDto, toProjectFromRepositoryInput } from '../dto/project-from-repository.dto.js';
import { ProjectRepositoryDto, toProjectRepositoryInput } from '../dto/project-repository.dto.js';

type Body = Record<string, unknown>;

async function check<T extends object>(
  type: new () => T,
  body: Body,
): Promise<{ dto: T; errors: string[] }> {
  const dto = plainToInstance(type, body);
  const errors = await validate(dto, { whitelist: true });

  return { dto, errors: errors.map((error) => error.property) };
}

describe('ListProjectsDto', () => {
  it('applies the defaults', async () => {
    const { dto, errors } = await check(ListProjectsDto, {});

    expect(errors).toEqual([]);
    expect(toListProjectsInput(dto)).toEqual({ page: 1, perPage: 50, search: '' });
  });

  it('trims the search', async () => {
    const { dto } = await check(ListProjectsDto, { search: '  hello ' });

    expect(dto.search).toBe('hello');
  });

  it.each([
    ['a string page', { page: '1' }, 'page'],
    ['a zero page', { page: 0 }, 'page'],
    ['a null page', { page: null }, 'page'],
    ['a perPage of 101', { perPage: 101 }, 'perPage'],
    ['a zero perPage', { perPage: 0 }, 'perPage'],
    ['a fractional perPage', { perPage: 1.5 }, 'perPage'],
    ['a null search', { search: null }, 'search'],
    ['a numeric search', { search: 5 }, 'search'],
    ['a 101 code point search', { search: 'a'.repeat(101) }, 'search'],
  ])('rejects %s', async (_label, body, property) => {
    expect((await check(ListProjectsDto, body)).errors).toEqual([property]);
  });

  it('accepts 100 emoji as a search (100 code points)', async () => {
    expect((await check(ListProjectsDto, { search: '😀'.repeat(100) })).errors).toEqual([]);
  });
});

describe('CreateProjectDto', () => {
  it('trims the name and keeps a missing repository as a non-code project', async () => {
    const { dto, errors } = await check(CreateProjectDto, { name: '  Roadmap ', description: ' notes ' });

    expect(errors).toEqual([]);
    expect(toCreateProjectInput(dto)).toEqual({ name: 'Roadmap', description: 'notes', repository: null });
  });

  it.each([[undefined], [null], ['  '], ['']])('stores the blank description %p as none', async (description) => {
    const { dto, errors } = await check(CreateProjectDto, { name: 'x', description });

    expect(errors).toEqual([]);
    expect(toCreateProjectInput(dto).description).toBeNull();
  });

  it('maps a repository ref', async () => {
    const { dto, errors } = await check(CreateProjectDto, { name: 'x', repository: { fullName: 'octo/x' } });

    expect(errors).toEqual([]);
    expect(toCreateProjectInput(dto).repository).toEqual({ fullName: 'octo/x' });
  });

  it('accepts a null repository', async () => {
    const { dto, errors } = await check(CreateProjectDto, { name: 'x', repository: null });

    expect(errors).toEqual([]);
    expect(toCreateProjectInput(dto).repository).toBeNull();
  });

  it.each([
    ['a missing name', {}],
    ['a null name', { name: null }],
    ['a blank name', { name: '   ' }],
    ['a numeric name', { name: 5 }],
    ['a 101 code point name', { name: 'a'.repeat(101) }],
  ])('rejects %s', async (_label, body) => {
    expect((await check(CreateProjectDto, body)).errors).toEqual(['name']);
  });

  it('counts emoji once in the name and the description', async () => {
    expect((await check(CreateProjectDto, { name: '😀'.repeat(100), description: '😀'.repeat(2000) })).errors).toEqual([]);
    expect((await check(CreateProjectDto, { name: 'x', description: '😀'.repeat(2001) })).errors).toEqual(['description']);
  });

  it('rejects a numeric description', async () => {
    expect((await check(CreateProjectDto, { name: 'x', description: 5 })).errors).toEqual(['description']);
  });

  it.each([
    ['both ref fields', { githubId: 1, fullName: 'octo/x' }],
    ['no ref field', {}],
    ['a malformed fullName', { fullName: 'nope' }],
  ])('rejects a repository with %s', async (_label, repository) => {
    expect((await check(CreateProjectDto, { name: 'x', repository })).errors).toEqual(['repository']);
  });

  it.each([['text'], [5], [['a']]])('rejects the non-object repository %p', async (repository) => {
    expect((await check(CreateProjectDto, { name: 'x', repository })).errors).toEqual(['repository']);
  });
});

describe('ProjectFromRepositoryDto', () => {
  it('needs only the repository; the name is left to the default', async () => {
    const { dto, errors } = await check(ProjectFromRepositoryDto, { repository: { githubId: 7 } });

    expect(errors).toEqual([]);
    expect(toProjectFromRepositoryInput(dto)).toEqual({ repository: { githubId: 7 }, description: null });
  });

  it('keeps a trimmed name and description', async () => {
    const { dto } = await check(ProjectFromRepositoryDto, {
      repository: { githubId: 7 },
      name: ' Mine ',
      description: ' d ',
    });

    expect(toProjectFromRepositoryInput(dto)).toEqual({ repository: { githubId: 7 }, name: 'Mine', description: 'd' });
  });

  it.each([
    ['a missing repository', {}, 'repository'],
    ['a null repository', { repository: null }, 'repository'],
    ['a null name', { repository: { githubId: 7 }, name: null }, 'name'],
    ['a blank name', { repository: { githubId: 7 }, name: ' ' }, 'name'],
    ['a long name', { repository: { githubId: 7 }, name: 'a'.repeat(101) }, 'name'],
  ])('rejects %s', async (_label, body, property) => {
    expect((await check(ProjectFromRepositoryDto, body)).errors).toEqual([property]);
  });
});

describe('EditProjectDto', () => {
  it('maps an empty body to no changes', async () => {
    const { dto, errors } = await check(EditProjectDto, {});

    expect(errors).toEqual([]);
    expect(toEditProjectInput(dto)).toEqual({});
  });

  it.each([[null], ['  '], ['']])('clears the description with %p', async (description) => {
    const { dto, errors } = await check(EditProjectDto, { description });

    expect(errors).toEqual([]);
    expect(toEditProjectInput(dto)).toEqual({ description: null });
  });

  it('trims the name', async () => {
    const { dto } = await check(EditProjectDto, { name: ' New ' });

    expect(toEditProjectInput(dto)).toEqual({ name: 'New' });
  });

  it.each([[null], ['  '], [5]])('rejects the name %p', async (name) => {
    expect((await check(EditProjectDto, { name })).errors).toEqual(['name']);
  });
});

describe('ProjectRepositoryDto', () => {
  it('maps a ref', async () => {
    const { dto, errors } = await check(ProjectRepositoryDto, { repository: { fullName: 'octo/x' } });

    expect(errors).toEqual([]);
    expect(toProjectRepositoryInput(dto)).toEqual({ repository: { fullName: 'octo/x' } });
  });

  it('treats null as detach', async () => {
    const { dto, errors } = await check(ProjectRepositoryDto, { repository: null });

    expect(errors).toEqual([]);
    expect(toProjectRepositoryInput(dto)).toEqual({ repository: null });
  });

  it('rejects an absent key', async () => {
    expect((await check(ProjectRepositoryDto, {})).errors).toEqual(['repository']);
  });

  it.each([
    ['both ref fields', { githubId: 1, fullName: 'octo/x' }],
    ['no ref field', {}],
    ['a string', 'octo/x'],
  ])('rejects %s', async (_label, repository) => {
    expect((await check(ProjectRepositoryDto, { repository })).errors).toEqual(['repository']);
  });
});
