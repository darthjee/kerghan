import { execFileSync } from 'child_process';
import * as path from 'path';

// Proves the Repositories ESLint override (`eslint.config.mjs`,
// `security.md#module-boundaries`) with the real config: a snippet, linted as
// if it lived in `src/repositories/`, gets `no-restricted-imports` on every
// forbidden line and `no-restricted-globals` on `fetch`, and nothing on the
// allowlisted entry points. ESLint runs as a child process (its flat config
// loader needs native ESM, which Jest's CommonJS runtime does not provide).

const BACKEND_ROOT = path.join(__dirname, '..', '..', '..');
const ESLINT_BIN = path.join(BACKEND_ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');

const FORBIDDEN = [
  "import { Integration } from '../integrations/entities/integration.entity.js';",
  "import { User } from '../auth/entities/user.entity.js';",
  "import { IntegrationsEncryptionService } from '../integrations/integrations-encryption.service.js';",
  "import { GithubClientService } from '../integrations/github-client.service.js';",
  "import { GithubRepoClientService } from '../integrations/github-repo-client.service.js';",
  "import { GithubAppClientService } from '../integrations/github-app-client.service.js';",
  "import { IntegrationsService } from '../integrations/integrations.service.js';",
  "import { integrationNotFound } from '../integrations/integration-http-errors.js';",
  "import { AuthService } from '../auth/auth.service.js';",
  "import type { Integration as I } from '../../integrations/entities/integration.entity.js';",
  "import { IntegrationDeletedListener } from '../integrations/events/other.listener.js';",
  "import { UserRegisteredEvent } from '../auth/events/user-registered.event.js';",
];

const ALLOWED = [
  "import { IntegrationsGithubService } from '../integrations/integrations-github.public.js';",
  "import type { GithubRepo } from '../integrations/github-repo-results.js';",
  "import { walkAddCandidates } from '../integrations/add-candidate-walk.js';",
  "import { IntegrationDeletedEvent } from '../integrations/events/integration-deleted.event.js';",
  "import { AccountHandleService } from '../auth/account-handle.service.js';",
  "import { AuthModule } from '../auth/auth.module.js';",
  "import { UserDeletedEvent } from '../auth/events/user-deleted.event.js';",
  "import { Clock } from '../core/clock.js';",
];

interface LintMessage {
  ruleId: string | null;
  line: number;
}

/**
 * Lints a snippet as `src/repositories/<file>` with the real config.
 * @param file - The pretend file name inside the module.
 * @param lines - The snippet's lines.
 * @returns The messages.
 */
function lint(file: string, lines: string[]): LintMessage[] {
  let output: string;

  try {
    output = execFileSync(
      process.execPath,
      [ESLINT_BIN, '--format', 'json', '--no-ignore', '--stdin', '--stdin-filename', file],
      { cwd: BACKEND_ROOT, input: `${lines.join('\n')}\n`, encoding: 'utf8' },
    );
  } catch (error) {
    // ESLint exits 1 when it reports errors; the JSON is still on stdout.
    output = (error as { stdout: string }).stdout;
  }

  return (JSON.parse(output) as Array<{ messages: LintMessage[] }>)[0].messages;
}

describe('Repositories ESLint boundary', () => {
  jest.setTimeout(120_000);

  let messages: LintMessage[];
  let testMessages: LintMessage[];
  const snippet = [...FORBIDDEN, ...ALLOWED, 'export const call = fetch;'];

  beforeAll(() => {
    messages = lint('src/repositories/boundary-probe.ts', snippet);
    testMessages = lint('src/repositories/tests/boundary-probe.spec.ts', snippet);
  });

  function rulesOn(line: number, from: LintMessage[] = messages): (string | null)[] {
    return from.filter((message) => message.line === line).map((message) => message.ruleId);
  }

  it.each(FORBIDDEN.map((code, index) => [code, index + 1]))('refuses %s', (_code, line) => {
    expect(rulesOn(line)).toContain('no-restricted-imports');
  });

  it.each(ALLOWED.map((code, index) => [code, FORBIDDEN.length + index + 1]))('allows %s', (_code, line) => {
    expect(rulesOn(line)).not.toContain('no-restricted-imports');
  });

  it('refuses fetch', () => {
    expect(rulesOn(snippet.length)).toContain('no-restricted-globals');
  });

  it('leaves the module tests free to import the Integrations fakes', () => {
    expect(testMessages.map((message) => message.ruleId)).not.toContain('no-restricted-imports');
    expect(testMessages.map((message) => message.ruleId)).not.toContain('no-restricted-globals');
  });
});
