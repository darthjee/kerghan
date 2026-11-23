import { readFileSync } from 'fs';
import * as path from 'path';
import { INTEGRATIONS_ROOT, SRC_ROOT, sourcesUnder } from './support/source-files.js';

// Static check (`docs/agents/modules/issues/security.md#write-access-to-github`): the read service
// and the repo client make GET calls only; the one PATCH lives in the issue client's `updateIssue`
// and is reached only from the writer. No app boot, no DB.

const METHOD = /method:\s*['"`](\w+)['"`]/g;

/**
 * The text of an Integrations source.
 * @param {string} name - The file name.
 * @returns {string} The text.
 */
function read(name: string): string {
  return readFileSync(path.join(INTEGRATIONS_ROOT, name), 'utf8');
}

/**
 * The HTTP methods a source names.
 * @param {string} text - The source text.
 * @returns {string[]} The methods, in order.
 */
function methodsIn(text: string): string[] {
  return [...text.matchAll(METHOD)].map((match) => match[1]);
}

describe('GET-only GitHub access (static)', () => {
  it('IntegrationsGithubService names no method and never calls fetch itself', () => {
    const text = read('integrations-github.service.ts');

    expect(methodsIn(text)).toEqual([]);
    expect(text).not.toMatch(/\bfetch\(/);
    expect(text).not.toMatch(/\bupdateIssue\(/);
    expect(text).not.toMatch(/PATCH|POST|PUT|DELETE/);
  });

  it('GithubRepoClientService sends GETs, plus the installation-token mint POST (the allowlisted exception)', () => {
    const methods = methodsIn(read('github-repo-client.service.ts'));

    expect(methods.filter((method) => method !== 'GET')).toEqual(['POST']);
    expect(read('github-repo-client.service.ts')).toMatch(/method: 'POST',\s*\n\s*headers: \{ \.\.\.apiHeaders\(`Bearer \$\{jwt\.reveal\(\)\}`\)/);
  });

  describe('GithubIssueClientService', () => {
    const text = read('github-issue-client.service.ts');
    const updateStart = text.indexOf('async updateIssue(');
    const updateEnd = text.indexOf('async #call<');

    it('finds the update method', () => {
      expect(updateStart).toBeGreaterThan(0);
      expect(updateEnd).toBeGreaterThan(updateStart);
    });

    it('sends GET from its read methods', () => {
      expect(methodsIn(text.slice(text.indexOf('async getIssue('), updateStart))).toEqual(['GET', 'GET']);
    });

    it('sends PATCH only from updateIssue', () => {
      expect(methodsIn(text.slice(updateStart, updateEnd))).toEqual(['PATCH']);
      expect(methodsIn(text.slice(updateEnd))).toEqual([]);
    });
  });

  it('no other source names a PATCH method, and updateIssue of the client is reached only from the writer', () => {
    const sources = sourcesUnder(SRC_ROOT);
    const patchers = sources.filter((file) => methodsIn(readFileSync(file, 'utf8')).includes('PATCH'));
    const callers = sources.filter((file) => /\.updateIssue\(/.test(readFileSync(file, 'utf8')));

    expect(patchers.map((file) => path.relative(INTEGRATIONS_ROOT, file))).toEqual(['github-issue-client.service.ts']);
    // Inside Integrations only the writer calls the client; outside it, only the issues sync service
    // calls the writer (its allowlist is pinned by `integrations-writer-boundary.spec.ts`).
    expect(callers.map((file) => path.relative(INTEGRATIONS_ROOT, file))).toEqual([
      'integrations-github-issue-writer.service.ts',
      path.join('..', 'issues', 'issues-sync.service.ts'),
    ]);
  });

  it('only the writer and the read service inject the issue client', () => {
    const injectors = sourcesUnder(INTEGRATIONS_ROOT)
      .filter((file) => /readonly \w+: GithubIssueClientService/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(INTEGRATIONS_ROOT, file))
      .sort();

    expect(injectors).toEqual(['integrations-github-issue-writer.service.ts', 'integrations-github.service.ts']);
  });
});
