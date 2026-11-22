import { QueryFailedError } from 'typeorm';
import { duplicateEntryIndex, PROJECT_NAME_INDEX, PROJECT_REPOSITORY_INDEX } from '../duplicate-entry.js';

const dupEntry = (sqlMessage: string, code = 'ER_DUP_ENTRY'): QueryFailedError => new QueryFailedError(
  'INSERT', [], Object.assign(new Error(sqlMessage), { code, sqlMessage }),
);

describe('duplicateEntryIndex', () => {
  it('reads the index of a MySQL 8 message, without the table prefix', () => {
    expect(duplicateEntryIndex(dupEntry(`Duplicate entry '1-name-0' for key 'issues_projects.${PROJECT_NAME_INDEX}'`))).toBe(PROJECT_NAME_INDEX);
  });

  it('reads an index without the table prefix', () => {
    expect(duplicateEntryIndex(dupEntry(`Duplicate entry '1-2-0' for key '${PROJECT_REPOSITORY_INDEX}'`))).toBe(PROJECT_REPOSITORY_INDEX);
  });

  it('reads the real suffix when the duplicated value imitates a key', () => {
    const value = '1-x\' for key \'foo-name-0';

    expect(duplicateEntryIndex(dupEntry(`Duplicate entry '${value}' for key 'issues_projects.${PROJECT_NAME_INDEX}'`))).toBe(PROJECT_NAME_INDEX);
  });

  it('reads the real suffix when the duplicated value imitates a whole table.index key', () => {
    const value = `1-x' for key 'issues_projects.${PROJECT_REPOSITORY_INDEX}`;

    expect(duplicateEntryIndex(dupEntry(`Duplicate entry '${value}-0' for key 'issues_projects.${PROJECT_NAME_INDEX}'`))).toBe(PROJECT_NAME_INDEX);
  });

  it('answers an empty name when the message names no key', () => {
    expect(duplicateEntryIndex(dupEntry('Duplicate entry \'a\''))).toBe('');
  });

  it('answers null for other driver errors and other errors', () => {
    expect(duplicateEntryIndex(dupEntry('boom', 'ER_LOCK_DEADLOCK'))).toBeNull();
    expect(duplicateEntryIndex(new Error('Duplicate entry'))).toBeNull();
  });
});
