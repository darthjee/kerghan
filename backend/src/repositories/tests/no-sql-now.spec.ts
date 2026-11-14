import { readFileSync } from 'fs';
import * as path from 'path';
import { moduleSources, REPOSITORIES_ROOT } from './support/module-sources.js';

// Static check (`docs/agents/modules/repositories/sync.md#time-source`): no SQL time condition of the
// Repositories module uses the database clock; every time value comes from
// the injected `Clock`.
const ROOT = REPOSITORIES_ROOT;
// `.now(` (the injected `clock.now()`) is not SQL; the lookbehind skips it.
const FORBIDDEN = [/(?<!\.)\bNOW\s*\(/i, /\bCURRENT_TIMESTAMP\b/i, /\bSYSDATE\s*\(/i, /\bUTC_TIMESTAMP\b/i];
// The wall clock is never read directly either (`docs/agents/modules/repositories/sync.md#time-source`).
const WALL_CLOCK = [/\bDate\.now\s*\(/, /new Date\(\s*\)/];

describe('Repositories sources (static)', () => {
  const files = moduleSources();

  it('scans the module sources, tests excluded', () => {
    expect(files.length).toBeGreaterThan(5);
    expect(files.some((file) => file.includes(`${path.sep}tests${path.sep}`))).toBe(false);
  });

  it.each(files.map((file) => [path.relative(ROOT, file), file]))('%s never uses NOW() / CURRENT_TIMESTAMP', (_name, file) => {
    const text = readFileSync(file, 'utf8');

    for (const pattern of [...FORBIDDEN, ...WALL_CLOCK]) {
      expect(text).not.toMatch(pattern);
    }
  });

  it('flags the forbidden tokens and lets clock.now() through', () => {
    expect('WHERE heartbeat_at < NOW()').toMatch(FORBIDDEN[0]);
    expect('SET x = now ()').toMatch(FORBIDDEN[0]);
    expect('DEFAULT CURRENT_TIMESTAMP').toMatch(FORBIDDEN[1]);
    expect('this.clock.now()').not.toMatch(FORBIDDEN[0]);
    expect('Date.now()').toMatch(WALL_CLOCK[0]);
  });
});
