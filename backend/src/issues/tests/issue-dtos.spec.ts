import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AttachIssueDto, toAttachIssueInput } from '../dto/attach-issue.dto.js';
import { CreateIssueDto, toCreateIssueInput } from '../dto/create-issue.dto.js';
import { EditIssueDto, toEditIssueInput } from '../dto/edit-issue.dto.js';
import { ImportIssueDto, toImportIssueInput } from '../dto/import-issue.dto.js';
import { normalizeBody } from '../dto/issue-fields.js';
import { ListIssuesDto, toListIssuesInput } from '../dto/list-issues.dto.js';
import { UnlinkIssueDto, toUnlinkIssueInput } from '../dto/unlink-issue.dto.js';

type Body = Record<string, unknown>;

async function check<T extends object>(
  type: new () => T,
  body: Body,
): Promise<{ dto: T; errors: string[] }> {
  const dto = plainToInstance(type, body);
  const errors = await validate(dto, { whitelist: true });

  return { dto, errors: errors.map((error) => error.property) };
}

describe('normalizeBody', () => {
  it.each([
    [null, null],
    [undefined, null],
    ['', null],
    ['  ', '  '],
    ['text', 'text'],
  ])('maps %j to %j', (input, expected) => {
    expect(normalizeBody(input)).toBe(expected);
  });
});

describe('CreateIssueDto', () => {
  it('applies the state default and trims only the title', async () => {
    const { dto, errors } = await check(CreateIssueDto, { title: '  Fix it ', body: '  keep  ' });

    expect(errors).toEqual([]);
    expect(toCreateIssueInput(dto)).toEqual({ title: 'Fix it', body: '  keep  ', state: 'open' });
  });

  it.each([
    [{ body: '' }, null],
    [{ body: null }, null],
    [{}, null],
    [{ body: '   ' }, '   '],
  ])('normalizes the body of %j to %j', async (extra, body) => {
    const { dto, errors } = await check(CreateIssueDto, { title: 'T', ...extra });

    expect(errors).toEqual([]);
    expect(toCreateIssueInput(dto).body).toBe(body);
  });

  it.each([
    ['a missing title', {}, 'title'],
    ['a null title', { title: null }, 'title'],
    ['a numeric title', { title: 1 }, 'title'],
    ['an empty title', { title: '' }, 'title'],
    ['a blank title', { title: '   ' }, 'title'],
    ['a 257 code point title', { title: 'a'.repeat(257) }, 'title'],
    ['a numeric body', { title: 'T', body: 1 }, 'body'],
    ['a boolean body', { title: 'T', body: true }, 'body'],
    ['a 65537 code point body', { title: 'T', body: 'a'.repeat(65537) }, 'body'],
    ['a bad state', { title: 'T', state: 'all' }, 'state'],
    ['a null state', { title: 'T', state: null }, 'state'],
  ])('rejects %s', async (_label, body, property) => {
    expect((await check(CreateIssueDto, body)).errors).toEqual([property]);
  });

  it('accepts 256 emoji as a title and 65536 code points as a body', async () => {
    expect((await check(CreateIssueDto, { title: '😀'.repeat(256) })).errors).toEqual([]);
    expect((await check(CreateIssueDto, { title: 'T', body: '😀'.repeat(65536) })).errors).toEqual([]);
  });

  it('rejects 257 emoji as a title', async () => {
    expect((await check(CreateIssueDto, { title: '😀'.repeat(257) })).errors).toEqual(['title']);
  });
});

describe('EditIssueDto', () => {
  it('keeps absent members absent', async () => {
    const { dto, errors } = await check(EditIssueDto, {});

    expect(errors).toEqual([]);
    expect(toEditIssueInput(dto)).toEqual({});
  });

  it('maps every member, trimming the title and normalizing the body', async () => {
    const { dto, errors } = await check(EditIssueDto, { title: ' New ', body: '', state: 'closed' });

    expect(errors).toEqual([]);
    expect(toEditIssueInput(dto)).toEqual({ title: 'New', body: null, state: 'closed' });
  });

  it('keeps a whitespace-only body', async () => {
    const { dto } = await check(EditIssueDto, { body: ' \n ' });

    expect(toEditIssueInput(dto)).toEqual({ body: ' \n ' });
  });

  it('accepts a null body', async () => {
    const { dto, errors } = await check(EditIssueDto, { body: null });

    expect(errors).toEqual([]);
    expect(toEditIssueInput(dto)).toEqual({ body: null });
  });

  it.each([
    ['a null title', { title: null }, 'title'],
    ['a blank title', { title: '  ' }, 'title'],
    ['a numeric title', { title: 1 }, 'title'],
    ['a 257 code point title', { title: 'a'.repeat(257) }, 'title'],
    ['a boolean body', { body: true }, 'body'],
    ['a 65537 code point body', { body: 'a'.repeat(65537) }, 'body'],
    ['a null state', { state: null }, 'state'],
    ['a bad state', { state: 'all' }, 'state'],
    ['a boolean state', { state: true }, 'state'],
  ])('rejects %s', async (_label, body, property) => {
    expect((await check(EditIssueDto, body)).errors).toEqual([property]);
  });

  it('accepts 65536 code points as a body', async () => {
    expect((await check(EditIssueDto, { body: 'a'.repeat(65536) })).errors).toEqual([]);
  });
});

describe('ListIssuesDto', () => {
  it('applies the defaults', async () => {
    const { dto, errors } = await check(ListIssuesDto, {});

    expect(errors).toEqual([]);
    expect(toListIssuesInput(dto)).toEqual({ page: 1, perPage: 50, state: 'open', search: '' });
  });

  it('trims the search and takes the state', async () => {
    const { dto, errors } = await check(ListIssuesDto, { search: '  bug ', state: 'all' });

    expect(errors).toEqual([]);
    expect(toListIssuesInput(dto)).toEqual({ page: 1, perPage: 50, state: 'all', search: 'bug' });
  });

  it.each([
    ['a string page', { page: '1' }, 'page'],
    ['a zero page', { page: 0 }, 'page'],
    ['a perPage of 101', { perPage: 101 }, 'perPage'],
    ['a zero perPage', { perPage: 0 }, 'perPage'],
    ['a bad state', { state: 'merged' }, 'state'],
    ['a null state', { state: null }, 'state'],
    ['a null search', { search: null }, 'search'],
    ['a 101 code point search', { search: 'a'.repeat(101) }, 'search'],
  ])('rejects %s', async (_label, body, property) => {
    expect((await check(ListIssuesDto, body)).errors).toEqual([property]);
  });

  it('accepts 100 emoji as a search and perPage 100', async () => {
    expect((await check(ListIssuesDto, { search: '😀'.repeat(100), perPage: 100 })).errors).toEqual([]);
  });
});

describe('ImportIssueDto', () => {
  it.each([1, 2, 2_147_483_647])('accepts the number %j', async (number) => {
    const { dto, errors } = await check(ImportIssueDto, { number });

    expect(errors).toEqual([]);
    expect(toImportIssueInput(dto)).toEqual({ number });
  });

  it.each([
    ['a missing number', {}],
    ['zero', { number: 0 }],
    ['a negative number', { number: -1 }],
    ['2147483648', { number: 2_147_483_648 }],
    ['a numeric string', { number: '1' }],
    ['a fraction', { number: 1.5 }],
    ['null', { number: null }],
  ])('rejects %s', async (_label, body) => {
    expect((await check(ImportIssueDto, body)).errors).toEqual(['number']);
  });
});

describe('AttachIssueDto', () => {
  it('keeps the confirmation absent when not sent', async () => {
    const { dto, errors } = await check(AttachIssueDto, { number: 7 });

    expect(errors).toEqual([]);
    expect(toAttachIssueInput(dto)).toEqual({ number: 7 });
  });

  it('parses the confirmation to an instant', async () => {
    const { dto, errors } = await check(AttachIssueDto, { number: 7, confirmUpdatedAt: '2026-01-02T03:04:05.678Z' });

    expect(errors).toEqual([]);
    expect(toAttachIssueInput(dto)).toEqual({ number: 7, confirmUpdatedAt: new Date('2026-01-02T03:04:05.678Z') });
  });

  it.each([
    ['a missing number', {}, 'number'],
    ['a numeric string number', { number: '1' }, 'number'],
    ['zero', { number: 0 }, 'number'],
    ['2147483648', { number: 2_147_483_648 }, 'number'],
    ['a malformed confirmation', { number: 1, confirmUpdatedAt: 'yesterday' }, 'confirmUpdatedAt'],
    ['a confirmation without milliseconds', { number: 1, confirmUpdatedAt: '2026-01-02T03:04:05Z' }, 'confirmUpdatedAt'],
    ['a confirmation with an offset', { number: 1, confirmUpdatedAt: '2026-01-02T03:04:05.678+01:00' }, 'confirmUpdatedAt'],
    ['an impossible date', { number: 1, confirmUpdatedAt: '2026-13-45T03:04:05.678Z' }, 'confirmUpdatedAt'],
    ['a numeric confirmation', { number: 1, confirmUpdatedAt: 1_767_323_045_678 }, 'confirmUpdatedAt'],
  ])('rejects %s', async (_label, body, property) => {
    expect((await check(AttachIssueDto, body)).errors).toEqual([property]);
  });
});

describe('UnlinkIssueDto', () => {
  it.each([
    [{}, false],
    [{ discardUnsentChanges: false }, false],
    [{ discardUnsentChanges: true }, true],
  ])('maps %j to discardUnsentChanges %j', async (body, expected) => {
    const { dto, errors } = await check(UnlinkIssueDto, body);

    expect(errors).toEqual([]);
    expect(toUnlinkIssueInput(dto)).toEqual({ discardUnsentChanges: expected });
  });

  it.each([['"true"', 'true'], ['1', 1], ['null', null]])('rejects discardUnsentChanges %s', async (_label, value) => {
    expect((await check(UnlinkIssueDto, { discardUnsentChanges: value })).errors).toEqual(['discardUnsentChanges']);
  });
});
