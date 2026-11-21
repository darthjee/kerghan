import { readFileSync } from 'fs';
import * as path from 'path';
import { ISSUES_ROOT } from './support/module-sources.js';

// The Projects code never calls GitHub and never enqueues a job (`api/projects.md#project-creation`,
// "No GitHub call and no job"): none of its files imports the Integrations entry point or anything
// that launches work, so the constructors have no such dependency at all.
const PROJECT_FILES = [
  'projects.controller.ts',
  'projects.service.ts',
  'project-creator.ts',
  'project-repository-changer.ts',
  'project-links.ts',
  'project-store.ts',
  'open-issue-count.query.ts',
];
const FORBIDDEN = [/integrations/i, /sync-launcher/i, /sync-runner/i, /\bqueue\b/i, /\bjob\b/i, /\bfetch\s*\(/];

describe('Projects sources (static)', () => {
  it.each(PROJECT_FILES)('%s imports no GitHub, launcher, queue or job', (file) => {
    const text = readFileSync(path.join(ISSUES_ROOT, file), 'utf8');
    const imports = text.split('\n').filter((line) => line.startsWith('import '));

    for (const pattern of FORBIDDEN) {
      expect(imports.join('\n')).not.toMatch(pattern);
    }

    expect(text).not.toMatch(/\bfetch\s*\(/);
  });
});
