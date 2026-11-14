import 'reflect-metadata';
import { readFileSync } from 'fs';
import * as path from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import type { Integration } from '../../integrations/entities/integration.entity.js';
import { integrationRef } from '../../integrations/integration-response.js';
import {
  forbidden,
  githubRepo,
  integrationUnusable,
  listingPage,
  notFound,
  notModified,
  rateLimited,
  repository,
  timeout,
  unauthorized,
} from '../../integrations/tests/support/github-builders.js';
import { REPOSITORIES_ENTITIES } from '../entities/index.js';
import { moduleSources, REPOSITORIES_ROOT } from './support/module-sources.js';

// Static boundary checks (`security.md#module-boundaries`,
// `testing.md#module-boundaries`): no app boot, no DB. The lint override in
// `eslint.config.mjs` refuses the imports; `eslint-boundary.spec.ts` proves it.

const FORBIDDEN_TABLES = ['auth_users', 'integrations'];
const SQL_TABLE_USE = /\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+`?(auth_users|integrations)`?(?![\w-])/i;
const ENTITY_TABLE = /@Entity\(\s*\{?[^)]*['"`](auth_users|integrations)['"`]/;

describe('Repositories module boundaries (static)', () => {
  const files = moduleSources();

  it('scans the module sources, tests excluded', () => {
    expect(files.length).toBeGreaterThan(5);
    expect(files.some((file) => file.includes(`${path.sep}tests${path.sep}`))).toBe(false);
  });

  it.each(files.map((file) => [path.relative(REPOSITORIES_ROOT, file), file]))(
    '%s names no Auth / Integrations table and no secret column',
    (_name, file) => {
      const text = readFileSync(file, 'utf8');

      expect(text).not.toMatch(/auth_users/);
      expect(text).not.toMatch(/secret_iv/);
      expect(text).not.toMatch(SQL_TABLE_USE);
      expect(text).not.toMatch(ENTITY_TABLE);
    },
  );

  it('flags the forbidden table uses and lets the module’s own tables through', () => {
    expect('SELECT * FROM integrations WHERE').toMatch(SQL_TABLE_USE);
    expect('LEFT JOIN `auth_users` u').toMatch(SQL_TABLE_USE);
    expect("@Entity('integrations')").toMatch(ENTITY_TABLE);
    expect("@Entity({ name: 'auth_users' })").toMatch(ENTITY_TABLE);
    expect('FROM repositories_sources s').not.toMatch(SQL_TABLE_USE);
    expect('scope.integrations.map(').not.toMatch(SQL_TABLE_USE);
  });

  it('maps no entity to an Auth / Integrations table', () => {
    const tables = getMetadataArgsStorage().tables
      .filter((table) => (REPOSITORIES_ENTITIES as unknown[]).includes(table.target))
      .map((table) => table.name);

    expect(tables).toHaveLength(REPOSITORIES_ENTITIES.length);
    tables.forEach((name) => expect(FORBIDDEN_TABLES).not.toContain(name));
    tables.forEach((name) => expect(name).toMatch(/^repositories/));
  });

  describe('exported IntegrationsGithubService results', () => {
    it('IntegrationRef carries id, uuid, label and type only', () => {
      const row = {
        id: 1, uuid: 'u', userId: 2, label: 'l', type: 'pat', status: 'active', githubLogin: 'g',
        secretHint: 'h', secretIv: Buffer.alloc(12), secretCiphertext: Buffer.alloc(4), metadata: {},
      } as unknown as Integration;

      expect(Object.keys(integrationRef(row)).sort()).toEqual(['id', 'label', 'type', 'uuid']);
    });

    it('GithubRepo carries githubId, owner, name and private only', () => {
      expect(Object.keys(githubRepo()).sort()).toEqual(['githubId', 'name', 'owner', 'private']);
    });

    it.each([
      ['ok', listingPage(1, [githubRepo()]), ['etag', 'hasNext', 'kind', 'rateLimit', 'repos']],
      ['not_modified', notModified(), ['kind', 'rateLimit']],
      ['rate_limited', rateLimited(new Date('2026-01-01T00:00:00Z')), ['kind', 'resetAt']],
      ['invalid_credentials', unauthorized(), ['kind']],
      ['not_found', notFound(), ['kind']],
      ['unavailable', timeout(), ['kind', 'reason']],
      ['integration_unusable', integrationUnusable('status'), ['kind', 'reason']],
    ])('RepoPageResult %s has the allowlisted keys', (_kind, answer, keys) => {
      expect(Object.keys(answer.resultFor('listHandleRepositories')).sort()).toEqual(keys);
    });

    it.each([
      ['ok', repository(githubRepo()), ['kind', 'repo']],
      ['not_found', forbidden(), ['kind']],
      ['rate_limited', rateLimited(new Date('2026-01-01T00:00:00Z')), ['kind', 'resetAt']],
      ['invalid_credentials', unauthorized(), ['kind']],
      ['unavailable', timeout(), ['kind', 'reason']],
      ['integration_unusable', integrationUnusable('missing'), ['kind', 'reason']],
    ])('RepoResult %s has the allowlisted keys', (_kind, answer, keys) => {
      expect(Object.keys(answer.resultFor('getRepository')).sort()).toEqual(keys);
    });

    it('the rate-limit fields carry no other key', () => {
      const page = listingPage(1, []).resultFor('listRepositories') as { rateLimit: object };

      expect(Object.keys(page.rateLimit).sort()).toEqual(['rateLimitRemaining', 'rateLimitReset', 'retryAfter']);
    });
  });
});
