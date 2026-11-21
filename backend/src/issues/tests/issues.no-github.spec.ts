import { readFileSync } from 'fs';
import * as path from 'path';
import { ISSUES_ROOT } from './support/module-sources.js';

// The issues API never calls GitHub and enqueues work only through the `IssueSyncTrigger` port
// (`api/issues.md`): none of its files imports the Integrations entry point, a launcher, a queue
// or a job, so the service has no such dependency at all.
const ISSUE_FILES = [
  'issues.controller.ts',
  'issues.service.ts',
  'issue-store.ts',
  'issue-markers.ts',
  'issue-link-presenter.ts',
  'issue-sync-trigger.ts',
  'issue-edit-rate-limiter.ts',
];
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

  it('gives the service no constructor dependency on a GitHub client', () => {
    const text = readFileSync(path.join(ISSUES_ROOT, 'issues.service.ts'), 'utf8');

    expect(text).not.toMatch(/github.*client|octokit/i);
  });
});
