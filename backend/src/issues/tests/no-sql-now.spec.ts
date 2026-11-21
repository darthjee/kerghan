import { readFileSync } from 'fs';
import * as path from 'path';
import { ISSUES_ROOT, moduleSources } from './support/module-sources.js';

// Static check (`docs/agents/specs/issues/model.md`, conventions): no SQL time condition of the
// Issues module uses the database clock; every time value comes from the injected `Clock`.
// `.now(` (the injected `clock.now()`) is not SQL; the lookbehind skips it.
const FORBIDDEN = [/(?<!\.)\bNOW\s*\(/i, /\bCURRENT_TIMESTAMP\b/i, /\bSYSDATE\s*\(/i, /\bUTC_TIMESTAMP\b/i];
// The wall clock is never read directly either.
const WALL_CLOCK = [/\bDate\.now\s*\(/, /new Date\(\s*\)/];

describe('Issues sources (static)', () => {
  const files = moduleSources();

  it('scans the module sources, tests excluded', () => {
    expect(files.length).toBeGreaterThan(5);
    expect(files.some((file) => file.includes(`${path.sep}tests${path.sep}`))).toBe(false);
  });

  it.each(files.map((file) => [path.relative(ISSUES_ROOT, file), file]))('%s never uses NOW() / CURRENT_TIMESTAMP', (_name, file) => {
    const text = readFileSync(file, 'utf8');

    for (const pattern of [...FORBIDDEN, ...WALL_CLOCK]) {
      expect(text).not.toMatch(pattern);
    }
  });

  it('flags the forbidden tokens and lets clock.now() through', () => {
    expect('WHERE marked_at < NOW()').toMatch(FORBIDDEN[0]);
    expect('SET x = now ()').toMatch(FORBIDDEN[0]);
    expect('DEFAULT CURRENT_TIMESTAMP').toMatch(FORBIDDEN[1]);
    expect('SELECT SYSDATE()').toMatch(FORBIDDEN[2]);
    expect('SELECT UTC_TIMESTAMP').toMatch(FORBIDDEN[3]);
    expect('this.clock.now()').not.toMatch(FORBIDDEN[0]);
    expect('Date.now()').toMatch(WALL_CLOCK[0]);
    expect('new Date()').toMatch(WALL_CLOCK[1]);
  });
});
