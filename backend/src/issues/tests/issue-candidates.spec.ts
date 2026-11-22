import type { IntegrationsGithubService } from '../../integrations/integrations-github.public.js';
import { FakeIntegrationsGithubService } from '../../integrations/tests/support/fake-integrations-github.service.js';
import type { RepositoriesService } from '../../repositories/repositories.service.js';
import { IssueCandidates } from '../issue-candidates.js';
import { FakeProjectRepositories } from './support/fake-project-repositories.js';
import { integrationRef } from './support/integration-refs.js';

const USER = 7;
const REPOSITORY = 1;

function build(sources: number[]): { candidates: IssueCandidates; github: FakeIntegrationsGithubService } {
  const repositories = new FakeProjectRepositories().seed(USER, { repositoryId: REPOSITORY, githubId: 10, integrationSourceIds: sources });
  const github = new FakeIntegrationsGithubService();

  return {
    github,
    candidates: new IssueCandidates(
      repositories as unknown as RepositoriesService,
      github as unknown as IntegrationsGithubService,
    ),
  };
}

describe('IssueCandidates', () => {
  it('orders known writable, then unknown, then read-only, oldest first inside each group', async () => {
    const { candidates, github } = build([1, 2, 3, 4, 5, 6]);

    github.setUsable(USER, [
      integrationRef(1, 'read_only'),
      integrationRef(2, 'unknown'),
      integrationRef(3, 'writable'),
      integrationRef(4, 'read_only'),
      integrationRef(5, 'writable'),
      integrationRef(6, 'unknown'),
    ]);

    expect(await candidates.resolve(USER, REPOSITORY)).toEqual({ kind: 'candidates', ids: [3, 5, 2, 6, 1, 4] });
  });

  it('keeps only the usable integrations whose source lists the repository', async () => {
    const { candidates, github } = build([2]);

    github.setUsable(USER, [integrationRef(1), integrationRef(2), integrationRef(3)]);

    expect(await candidates.resolve(USER, REPOSITORY)).toEqual({ kind: 'candidates', ids: [2] });
  });

  it('answers no_credential for a repository only a handle lists', async () => {
    const { candidates, github } = build([]);

    github.setUsable(USER, [integrationRef(1)]);

    expect(await candidates.resolve(USER, REPOSITORY)).toEqual({ kind: 'none', reason: 'no_credential' });
  });

  it('answers credential_invalid when a listing integration is not usable', async () => {
    const { candidates, github } = build([1]);

    github.setUsable(USER, []).setIntegrations(USER, [integrationRef(1)]);

    expect(await candidates.resolve(USER, REPOSITORY)).toEqual({ kind: 'none', reason: 'credential_invalid' });
  });

  it('answers no_credential when the user has no integration at all', async () => {
    const { candidates } = build([1]);

    expect(await candidates.resolve(USER, REPOSITORY)).toEqual({ kind: 'none', reason: 'no_credential' });
  });

  it('answers no_credential when the not-usable integration does not list the repository', async () => {
    const { candidates, github } = build([1]);

    github.setUsable(USER, []).setIntegrations(USER, [integrationRef(2)]);

    expect(await candidates.resolve(USER, REPOSITORY)).toEqual({ kind: 'none', reason: 'no_credential' });
  });

  it('makes no GitHub call', async () => {
    const { candidates, github } = build([1]);

    github.setUsable(USER, [integrationRef(1)]);
    await candidates.resolve(USER, REPOSITORY);

    expect(github.githubCalls()).toEqual([]);
  });
});
