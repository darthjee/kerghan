import { readFileSync } from 'fs';
import * as path from 'path';
import { INTEGRATIONS_ROOT, SRC_ROOT, sourcesUnder } from './support/source-files.js';

// Static boundary check (`docs/agents/specs/issues/security.md#the-integrations-boundary`):
// `IntegrationsGithubIssueWriter` is the only non-GET GitHub call made with a user's credential,
// and only the issues sync service may inject it. No app boot, no DB.

/**
 * The files outside Integrations that may reference the writer (paths relative to `backend/src`).
 * Empty in #554; #558 adds the issues sync service here.
 */
const WRITER_INJECTORS: string[] = [];

const WRITER_REFERENCE = /\bIntegrationsGithubIssueWriter\b|integrations-github-issue-writer\.service/;

describe('IntegrationsGithubIssueWriter boundary (static)', () => {
  const outside = sourcesUnder(SRC_ROOT).filter((file) => !file.startsWith(`${INTEGRATIONS_ROOT}${path.sep}`));

  it('scans the sources outside Integrations, tests excluded', () => {
    expect(outside.length).toBeGreaterThan(20);
    expect(outside.some((file) => file.includes(`${path.sep}tests${path.sep}`))).toBe(false);
    expect(outside.some((file) => file.startsWith(INTEGRATIONS_ROOT))).toBe(false);
  });

  it('is referenced by no file outside Integrations, apart from the allowlist', () => {
    const offenders = outside
      .filter((file) => WRITER_REFERENCE.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file))
      .filter((file) => !WRITER_INJECTORS.includes(file));

    expect(offenders).toEqual([]);
  });

  it('starts with an empty allowlist', () => {
    expect(WRITER_INJECTORS).toEqual([]);
  });

  it('the matcher flags an import and a constructor injection, and not the read service', () => {
    expect("import { IntegrationsGithubIssueWriter } from '../integrations/integrations-github.public.js';").toMatch(WRITER_REFERENCE);
    expect('constructor(private readonly writer: IntegrationsGithubIssueWriter) {}').toMatch(WRITER_REFERENCE);
    expect("import { IntegrationsGithubIssueWriter } from './integrations-github-issue-writer.service.js';").toMatch(WRITER_REFERENCE);
    expect("import { w } from '../integrations/integrations-github-issue-writer.service.js';").toMatch(WRITER_REFERENCE);
    expect('constructor(private readonly github: IntegrationsGithubService) {}').not.toMatch(WRITER_REFERENCE);
  });
});
