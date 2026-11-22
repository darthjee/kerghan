import { readFileSync } from 'fs';
import * as path from 'path';
import { ISSUES_ROOT, moduleSources } from './support/module-sources.js';

// Static check (`docs/agents/specs/issues/security.md#review-checklist`, `security` item 7): request
// values reach SQL only as bound parameters. A template literal that reads as SQL may interpolate
// nothing but a named constant (a fixed sub-select such as `USER_PROJECT_IDS`); a value, a call or an
// expression in `${}` fails. The `LIKE` pattern is built outside the SQL text (`escapeLike`, bound).
const SQL_WORDS = /\b(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|ORDER BY|GROUP BY|LIMIT|FOR UPDATE)\b/;
const TEMPLATE = /`((?:[^`\\]|\\.)*)`/g;
const INTERPOLATION = /\$\{([^}]*)\}/g;
const NAMED_CONSTANT = /^[A-Z][A-Z0-9_]*$/;

/**
 * The interpolations of the SQL-looking template literals of a source that are not a named constant.
 * @param text - The source text.
 * @returns The offending expressions.
 */
export function unboundInterpolations(text: string): string[] {
  return [...text.matchAll(TEMPLATE)]
    .filter((template) => SQL_WORDS.test(template[1].replace(INTERPOLATION, '')))
    .flatMap((template) => [...template[1].matchAll(INTERPOLATION)].map((match) => match[1].trim()))
    .filter((expression) => !NAMED_CONSTANT.test(expression));
}

describe('Issues sources bind every value (static)', () => {
  const files = moduleSources();

  it('scans the module sources, tests excluded', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files.map((file) => [path.relative(ISSUES_ROOT, file), file]))('%s interpolates only named SQL constants', (_name, file) => {
    expect(unboundInterpolations(readFileSync(file, 'utf8'))).toEqual([]);
  });

  it('flags a value in a SQL template, and lets a named constant and a LIKE pattern through', () => {
    expect(unboundInterpolations('manager.query(`SELECT id FROM issues WHERE title = \'${title}\'`)')).toEqual(['title']);
    expect(unboundInterpolations('manager.query(`DELETE FROM issues WHERE project_id IN (${USER_PROJECT_IDS})`, [id])')).toEqual([]);
    expect(unboundInterpolations('{ search: `%${escapeLike(input.search)}%` }')).toEqual([]);
    expect(unboundInterpolations('`${PROJECT_LINK_IDS} FOR UPDATE`')).toEqual([]);
  });
});
