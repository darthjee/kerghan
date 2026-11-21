import 'reflect-metadata';
import { readFileSync } from 'fs';
import * as path from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import { ISSUES_ENTITIES } from '../entities/index.js';
import { ISSUES_ROOT, moduleSources } from './support/module-sources.js';

// Static boundary checks (`docs/agents/specs/issues/testing.md#security-verification`): no app
// boot, no DB. The lint override in `eslint.config.mjs` refuses the imports;
// `eslint-boundary.spec.ts` proves it.

const FORBIDDEN_TABLES = ['auth_users', 'integrations'];
const SQL_TABLE_USE = /\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+`?(auth_users|integrations)`?(?![\w-])/i;
const ENTITY_TABLE = /@Entity\(\s*\{?[^)]*['"`](auth_users|integrations)['"`]/;
const FETCH_CALL = /(?<![.\w])fetch\s*\(/;

describe('Issues module boundaries (static)', () => {
  const files = moduleSources();

  it('scans the module sources, tests excluded', () => {
    expect(files.length).toBeGreaterThan(5);
    expect(files.some((file) => file.includes(`${path.sep}tests${path.sep}`))).toBe(false);
  });

  it.each(files.map((file) => [path.relative(ISSUES_ROOT, file), file]))(
    '%s calls no fetch and names no Auth / Integrations table and no secret column',
    (_name, file) => {
      const text = readFileSync(file, 'utf8');

      expect(text).not.toMatch(FETCH_CALL);
      expect(text).not.toMatch(/auth_users/);
      expect(text).not.toMatch(/secret_iv/);
      expect(text).not.toMatch(SQL_TABLE_USE);
      expect(text).not.toMatch(ENTITY_TABLE);
    },
  );

  it('flags the forbidden uses and lets the module’s own tables through', () => {
    expect('SELECT * FROM integrations WHERE').toMatch(SQL_TABLE_USE);
    expect('LEFT JOIN `auth_users` u').toMatch(SQL_TABLE_USE);
    expect("@Entity('integrations')").toMatch(ENTITY_TABLE);
    expect("@Entity({ name: 'auth_users' })").toMatch(ENTITY_TABLE);
    expect('await fetch(url)').toMatch(FETCH_CALL);
    expect('FROM issues_github_links l').not.toMatch(SQL_TABLE_USE);
    expect('scope.integrations.map(').not.toMatch(SQL_TABLE_USE);
  });

  it('maps no entity to an Auth / Integrations table', () => {
    const tables = getMetadataArgsStorage().tables
      .filter((table) => (ISSUES_ENTITIES as unknown[]).includes(table.target))
      .map((table) => table.name);

    expect(tables).toHaveLength(ISSUES_ENTITIES.length);
    tables.forEach((name) => expect(FORBIDDEN_TABLES).not.toContain(name));
    tables.forEach((name) => expect(name).toMatch(/^issues/));
  });
});
