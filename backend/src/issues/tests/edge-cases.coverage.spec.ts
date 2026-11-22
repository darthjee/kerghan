import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import * as path from 'path';

// The coverage check of `docs/agents/specs/issues/testing.md` ("one test per row, citing its id"): every
// `E<n>` row of `edge-cases.md` is cited in the title or a comment of some spec under `backend/src/` or
// `frontend/specs/`, except the allowlist below. A new row without a test fails here.
//
// The check reads the spec document and the frontend specs, which sit outside `backend/`: it runs in CI
// (the whole checkout) and wherever the repository root is mounted next to `backend/`. A container that
// mounts only `backend/` skips it, with a note, rather than failing on files it cannot see.

const REPOSITORY_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const EDGE_CASES = path.join(REPOSITORY_ROOT, 'docs', 'agents', 'specs', 'issues', 'edge-cases.md');
const BACKEND_SOURCES = path.resolve(__dirname, '..', '..');
const FRONTEND_SPECS = path.join(REPOSITORY_ROOT, 'frontend', 'specs');

/**
 * The ids no spec cites yet, each with why. An entry is removed by the issue that covers it (the
 * second test fails on an entry that is already cited). No row is frontend-tier today: a row that
 * #560 to #562 will cover from the frontend goes here with its issue number.
 */
const ALLOWLIST: Record<string, string> = {
  E25: 'the future "remove repository" feature (no issue yet)',
  ...Object.fromEntries(
    [66, 67, 68, 69, 70, 71, 72, 73, 74].map((number) => [`E${number}`, '#563: bulk close and reopen']),
  ),
};

const SPEC_FILE = /\.(spec|e2e-spec|db-spec)\.ts$|[sS]pec\.jsx?$/;

/**
 * Every spec file under a directory.
 * @param dir - The directory.
 * @returns The absolute paths.
 */
function specFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);

    if (entry === 'node_modules') return [];
    if (statSync(full).isDirectory()) return specFiles(full);

    return SPEC_FILE.test(entry) && full !== __filename ? [full] : [];
  });
}

const available = existsSync(EDGE_CASES);

if (!available) {
  // eslint-disable-next-line no-console
  console.warn(`edge-cases.coverage.spec: ${EDGE_CASES} is not mounted here; the check runs in CI and where the repository root is mounted.`);
}

(available ? describe : describe.skip)('Issues edge-case coverage (static)', () => {
  let ids: string[] = [];
  let cited = new Set<string>();

  beforeAll(() => {
    ids = [...new Set([...readFileSync(EDGE_CASES, 'utf8').matchAll(/^\| (E\d+) \|/gm)].map((match) => match[1]))];
    cited = new Set(
      [...specFiles(BACKEND_SOURCES), ...specFiles(FRONTEND_SPECS)]
        .flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/\bE\d+\b/g)].map((match) => match[0])),
    );
  });

  it('parses every edge-case row of the document', () => {
    expect(ids.length).toBeGreaterThanOrEqual(74);
    expect(ids).toEqual(expect.arrayContaining(['E1', 'E25', 'E56', 'E74']));
  });

  it('cites every edge case in some spec, bar the allowlist', () => {
    const uncited = ids.filter((id) => !cited.has(id) && !(id in ALLOWLIST));

    expect(uncited).toEqual([]);
  });

  it('allowlists only rows that exist and are still uncited (remove an entry once its spec lands)', () => {
    const stale = Object.keys(ALLOWLIST).filter((id) => !ids.includes(id) || cited.has(id));

    expect(stale).toEqual([]);
  });
});
