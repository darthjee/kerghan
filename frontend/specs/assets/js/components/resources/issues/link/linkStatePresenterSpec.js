import LinkStatePresenter from '../../../../../../../assets/js/components/resources/issues/link/linkStatePresenter.js';
import { buildLink, buildProjectRepository } from '../../../../../../support/issuesBuilders.js';

describe('LinkStatePresenter', () => {
  const now = Date.parse('2026-11-07T12:00:00.000Z');
  const repository = buildProjectRepository();
  const present = (overrides) => LinkStatePresenter.present(buildLink(overrides), repository, now);
  const FIX = { href: '#/account/integrations', text: 'Fix it in Integrations' };

  describe('unlinked view', () => {
    it('offers linking for an added repository', () => {
      expect(LinkStatePresenter.present(null, repository, now))
        .toEqual({ linked: false, text: 'Not linked to GitHub', canAttach: true, hint: null });
    });

    it('offers linking for an unknown repository', () => {
      expect(LinkStatePresenter.present(null, buildProjectRepository({ status: 'unknown' }), now).canAttach).toBeTrue();
    });

    it('hints at connecting a repository when the project has none', () => {
      expect(LinkStatePresenter.present(null, null, now))
        .toEqual({ linked: false, text: 'Not linked to GitHub', canAttach: false, hint: 'Connect a repository to link issues' });
    });

    it('hints at an unavailable repository', () => {
      const view = LinkStatePresenter.present(null, buildProjectRepository({ status: 'unavailable' }), now);

      expect(view.canAttach).toBeFalse();
      expect(view.hint).toBe('The project\'s repository is unavailable');
    });
  });

  describe('linked states', () => {
    it('linked: message with the last synced time and Refresh, Unlink', () => {
      const view = present({ lastSyncedAt: '2026-11-07T11:55:00.000Z' });

      expect(view.linked).toBeTrue();
      expect(view.state).toBe('linked');
      expect(view.number).toBe(12);
      expect(view.message).toEqual({ text: 'Linked to GitHub #12 · last synced 5 min ago' });
      expect(view.lastSynced).toBeNull();
      expect(view.secondary).toEqual([]);
      expect(view.actions).toEqual(['refresh', 'unlink']);
    });

    it('linked and stale: adds the out of date mark', () => {
      expect(present({ stale: true, lastSyncedAt: '2026-11-07T11:55:00.000Z' }).message.text)
        .toBe('Linked to GitHub #12 · last synced 5 min ago (may be out of date)');
    });

    it('pending: message, last synced line, Refresh, Unlink', () => {
      const view = present({ state: 'pending', states: ['pending'], lastSyncedAt: '2026-11-07T11:00:00.000Z' });

      expect(view.message).toEqual({ text: 'Changes are waiting to be sent to GitHub.' });
      expect(view.lastSynced).toBe('last synced 1 h ago');
      expect(view.actions).toEqual(['refresh', 'unlink']);
    });

    it('pending and stale: the last synced line is marked', () => {
      expect(present({ state: 'pending', states: ['pending'], stale: true }).lastSynced).toContain('(may be out of date)');
    });

    it('rate_limited (E17): the reset time in local time and relative', () => {
      const until = now + 5 * 60000;
      const view = present({ state: 'rate_limited', states: ['rate_limited'], rateLimitedUntil: new Date(until).toISOString() });
      const date = new Date(until);
      const clock = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

      expect(view.message.text).toBe(`GitHub's rate limit was reached; sync resumes at ${clock} (in 5 min).`);
      expect(view.actions).toEqual(['refresh', 'unlink']);
    });

    it('rate_limited with a past time (U7): sync should resume shortly', () => {
      const view = present({ state: 'rate_limited', states: ['rate_limited'], rateLimitedUntil: '2026-11-07T11:00:00.000Z' });

      expect(view.message.text).toBe('GitHub\'s rate limit was reached. Sync should resume shortly.');
    });

    it('rate_limited with a null time (U7): sync should resume shortly', () => {
      const view = present({ state: 'rate_limited', states: ['rate_limited'], rateLimitedUntil: null });

      expect(view.message.text).toContain('Sync should resume shortly.');
    });

    it('repository_unavailable: link to repositories, Unlink only', () => {
      const view = present({ state: 'repository_unavailable', states: ['repository_unavailable'] });

      expect(view.message).toEqual({
        text: 'This project\'s repository is unavailable, so sync is paused.',
        link: { href: '#/repositories', text: 'Open repositories' },
      });
      expect(view.actions).toEqual(['unlink']);
    });

    it('sync_failed retries_exhausted: Retry sync, Unlink', () => {
      const view = present({ state: 'sync_failed', states: ['sync_failed'], reason: 'retries_exhausted' });

      expect(view.message).toEqual({ text: 'Sync failed after several attempts.' });
      expect(view.actions).toEqual(['retrySync', 'unlink']);
    });

    [
      ['no_credential', 'E20', 'No GitHub credential can access this repository.'],
      ['credential_invalid', 'E19', 'The GitHub credential for this repository is no longer valid.'],
      ['forbidden', 'E21', 'The GitHub credential for this repository can\'t update issues.'],
    ].forEach(([reason, edge, text]) => {
      it(`sync_failed ${reason} (${edge}): its sentence and the Fix link`, () => {
        const view = present({ state: 'sync_failed', states: ['sync_failed'], reason });

        expect(view.message).toEqual({ text, link: FIX });
        expect(view.actions).toEqual(['retrySync', 'unlink']);
      });
    });

    it('sync_failed with an unknown reason: the generic message', () => {
      expect(present({ state: 'sync_failed', states: ['sync_failed'], reason: 'other' }).message.text)
        .toBe('Sync failed after several attempts.');
    });

    it('gone deleted (E1): Unlink only, no last synced', () => {
      const view = present({ state: 'gone', states: ['gone'], reason: 'deleted' });

      expect(view.message.text).toBe('The GitHub issue was deleted. This issue stays in Kerghan; edits stay local.');
      expect(view.lastSynced).toBeNull();
      expect(view.actions).toEqual(['unlink']);
    });

    it('gone moved (E2): Unlink only', () => {
      const view = present({ state: 'gone', states: ['gone'], reason: 'moved' });

      expect(view.message.text)
        .toBe('The GitHub issue was moved to another repository. This issue stays in Kerghan; edits stay local.');
      expect(view.actions).toEqual(['unlink']);
    });

    it('gone with an unknown reason: a generic message', () => {
      expect(present({ state: 'gone', states: ['gone'], reason: null }).message.text)
        .toBe('The GitHub issue is no longer available. This issue stays in Kerghan; edits stay local.');
    });
  });

  describe('secondary states and actions', () => {
    it('shows the other states as secondary lines with their messages', () => {
      const view = present({ state: 'sync_failed', states: ['sync_failed', 'pending'], reason: 'credential_invalid' });

      expect(view.message.text).toContain('no longer valid');
      expect(view.secondary).toEqual([{ state: 'pending', text: 'Changes are waiting to be sent to GitHub.' }]);
      expect(view.actions).toEqual(['retrySync', 'unlink']);
    });

    it('removes Retry sync when the repository is unavailable and keeps the failure visible', () => {
      const view = present({
        state: 'sync_failed', states: ['sync_failed', 'repository_unavailable'], reason: 'forbidden',
      });

      expect(view.message.text).toContain('can\'t update issues');
      expect(view.secondary[0].state).toBe('repository_unavailable');
      expect(view.actions).toEqual(['unlink']);
    });

    it('removes Refresh when the repository is unavailable behind a pending write', () => {
      expect(present({ state: 'repository_unavailable', states: ['repository_unavailable', 'pending'] }).actions)
        .toEqual(['unlink']);
    });

    it('offers Unlink only when gone, even with other states', () => {
      expect(present({ state: 'gone', states: ['gone', 'pending'], reason: 'deleted' }).actions).toEqual(['unlink']);
    });

    it('falls back to the primary state when states is missing', () => {
      expect(present({ state: 'pending', states: undefined }).actions).toEqual(['refresh', 'unlink']);
    });

    it('shows an unknown state with an empty message', () => {
      expect(present({ state: 'mystery', states: ['mystery'] }).message).toEqual({ text: '' });
    });
  });

  describe('external url', () => {
    it('keeps a github.com url', () => {
      expect(present().url).toBe('https://github.com/darthjee/kerghan/issues/12');
    });

    ['javascript:alert(1)', 'https://evil.example/x', undefined, null].forEach((url) => {
      it(`drops ${url}`, () => {
        expect(present({ url }).url).toBeNull();
      });
    });
  });
});
