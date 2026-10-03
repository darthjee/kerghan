import { HttpException } from '@nestjs/common';
import { GithubUnavailableError, InstallationNotAccessibleError } from '../integration-errors.js';
import { buildIntegrationsHarness, IntegrationsHarness } from './support/integrations-harness.js';

const USER = 1;

describe('IntegrationCredentialService#attempt', () => {
  let h: IntegrationsHarness;

  beforeEach(() => {
    h = buildIntegrationsHarness({ maxAttempts: 3 });
  });

  const failures = (): number => h.guard.state.get(USER)?.failedAttempts ?? 0;

  it('resets the cool-off on success by default', async () => {
    h.guard.state.set(USER, { failedAttempts: 2, lockedUntil: null });

    expect(await h.credentials.attempt(USER, async () => 'ok')).toBe('ok');
    expect(failures()).toBe(0);
  });

  it('only gives the attempt back when the result does not reset', async () => {
    h.guard.state.set(USER, { failedAttempts: 2, lockedUntil: null });

    expect(await h.credentials.attempt(USER, async () => 'selection', () => false)).toBe('selection');
    expect(failures()).toBe(2);
  });

  it('keeps a counted domain failure, as an HTTP error', async () => {
    const error = await h.credentials.attempt(USER, async () => {
      throw new InstallationNotAccessibleError();
    }).catch((caught: unknown) => caught) as HttpException;

    expect(error.getStatus()).toBe(422);
    expect(error.getResponse()).toMatchObject({ code: 'INTEGRATION_INSTALLATION_NOT_ACCESSIBLE' });
    expect(failures()).toBe(1);
  });

  it('releases an uncounted domain failure', async () => {
    const error = await h.credentials.attempt(USER, async () => {
      throw new GithubUnavailableError();
    }).catch((caught: unknown) => caught) as HttpException;

    expect(error.getStatus()).toBe(502);
    expect(failures()).toBe(0);
  });

  it('releases and rethrows an unexpected error', async () => {
    await expect(h.credentials.attempt(USER, async () => {
      throw new TypeError('bug');
    })).rejects.toBeInstanceOf(TypeError);
    expect(failures()).toBe(0);
  });

  it('answers 423 without running while locked', async () => {
    h.guard.state.set(USER, { failedAttempts: 3, lockedUntil: new Date(Date.now() + 60000) });
    const run = jest.fn();

    const error = await h.credentials.attempt(USER, run).catch((caught: unknown) => caught) as HttpException;

    expect(error.getStatus()).toBe(423);
    expect(run).not.toHaveBeenCalled();
  });
});
