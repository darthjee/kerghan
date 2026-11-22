import { readFileSync } from 'fs';
import * as path from 'path';
import { ISSUES_ROOT, moduleSources } from './support/module-sources.js';

// The issues API (list, create, show, edit, delete) never calls GitHub and enqueues work only
// through the `IssueSyncTrigger` port (`api/issues.md`): none of its files imports the
// Integrations entry point, a launcher, a queue or a job, so the service has no such dependency
// at all. The GitHub link routes (#557) are the one exception: they make the single GitHub read of
// a link creation, so the claim is narrowed to the files below and the files that do import
// Integrations are pinned to `LINK_FILES`, through the `.public` entry only.
const ISSUE_FILES = [
  'issues.controller.ts',
  'issues.service.ts',
  'issue-store.ts',
  'issue-markers.ts',
  'issue-link-presenter.ts',
  'issue-sync-trigger.ts',
  'issue-edit-rate-limiter.ts',
];
// The only Issues sources that may import Integrations (through `integrations-github.public`).
const LINK_FILES = [
  'github-values.ts',
  'issue-candidates.ts',
  'issue-github-reader.ts',
  'issue-link-writer.ts',
  'issue-links.service.ts',
  'issues.module.ts',
];
// The sync (#558) reads and writes GitHub for a link, with the owner's integrations: the issues sync
// service is the one file that may name the writer, and `issue-sync-github.ts` reads only.
const SYNC_FILES = ['issue-sync-github.ts', 'issues-sync.service.ts'];
const FORBIDDEN = [/integrations/i, /sync-launcher/i, /sync-runner/i, /\bqueue\b/i, /\bjob\b/i, /\bfetch\s*\(/];

describe('Issues sources (static)', () => {
  it.each(ISSUE_FILES)('%s imports no GitHub, launcher, queue or job', (file) => {
    const text = readFileSync(path.join(ISSUES_ROOT, file), 'utf8');
    const imports = text.split('\n').filter((line) => line.startsWith('import '));

    for (const pattern of FORBIDDEN) {
      expect(imports.join('\n')).not.toMatch(pattern);
    }

    expect(text).not.toMatch(/\bfetch\s*\(/);
  });

  it('limits the Integrations imports to the link files, through the public entry only', () => {
    const sourcesOf = (file: string): string[] => [...readFileSync(file, 'utf8').matchAll(/from '([^']*integrations[^']*)'/gi)].map((match) => match[1]);
    const importing = moduleSources().filter((file) => sourcesOf(file).length > 0).map((file) => path.relative(ISSUES_ROOT, file)).sort();

    expect(importing).toEqual([...LINK_FILES, ...SYNC_FILES].sort());

    for (const file of [...LINK_FILES, ...SYNC_FILES]) {
      sourcesOf(path.join(ISSUES_ROOT, file)).forEach((source) => expect(source).toMatch(/integrations\/integrations-github\.public\.js$/));
    }
  });

  it('makes no write call to GitHub: the link files use only the read operations', () => {
    for (const file of LINK_FILES) {
      expect(readFileSync(path.join(ISSUES_ROOT, file), 'utf8')).not.toMatch(/\bupdateIssue\b|IntegrationsGithubIssueWriter/);
    }
  });

  it('names the writer and the PATCH only in the issues sync service', () => {
    const named = moduleSources()
      .filter((file) => /\bupdateIssue\b|IntegrationsGithubIssueWriter/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(ISSUES_ROOT, file));

    expect(named).toEqual(['issues-sync.service.ts']);
    expect(readFileSync(path.join(ISSUES_ROOT, 'issue-sync-github.ts'), 'utf8')).not.toMatch(/\bupdateIssue\b|IntegrationsGithubIssueWriter/);
  });

  it('gives the service no constructor dependency on a GitHub client', () => {
    const text = readFileSync(path.join(ISSUES_ROOT, 'issues.service.ts'), 'utf8');

    expect(text).not.toMatch(/github.*client|octokit/i);
  });
});
