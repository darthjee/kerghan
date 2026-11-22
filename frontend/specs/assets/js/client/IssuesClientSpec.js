import IssuesClient from '../../../../assets/js/client/IssuesClient.js';
import { fetchSequence } from '../../../support/fetchSequence.js';
import {
  buildFailure, buildIssue, buildIssueListing, ISSUE_ID, PROJECT_ID,
} from '../../../support/issuesBuilders.js';

describe('IssuesClient', () => {
  let originalFetch;

  const base = `/projects/${PROJECT_ID}/issues`;
  const issueBase = `${base}/${ISSUE_ID}`;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  /**
   * Stub the transport with one successful answer.
   *
   * @param {object} [json] - The response body.
   * @returns {void}
   */
  function answer(json = {}) {
    globalThis.fetch = fetchSequence([{ ok: true, status: 200, json }]);
  }

  /**
   * Stub the transport with one failed answer.
   *
   * @param {number} status - HTTP status.
   * @param {string} code - Error code.
   * @param {object} [extra] - Further error fields.
   * @returns {void}
   */
  function fail(status, code, extra) {
    globalThis.fetch = fetchSequence([buildFailure(status, code, extra)]);
  }

  const sentPath = () => globalThis.fetch.calls.argsFor(0)[0];
  const sentBody = () => JSON.parse(globalThis.fetch.calls.argsFor(0)[1].body);

  describe('.list', () => {
    it('posts the filter and paging to the project issues endpoint', async () => {
      answer(buildIssueListing());

      const response = await IssuesClient.list(PROJECT_ID, {
        state: 'closed', search: 'bug', page: 2, perPage: 10,
      });

      expect(sentPath()).toBe(`${base}.json`);
      expect(globalThis.fetch.calls.argsFor(0)[1].method).toBe('POST');
      expect(sentBody()).toEqual({
        state: 'closed', search: 'bug', page: 2, perPage: 10,
      });
      expect(response.issues.length).toBe(1);
    });

    it('omits undefined fields and an empty search', async () => {
      answer();

      await IssuesClient.list(PROJECT_ID, { state: 'open', search: '' });

      expect(sentBody()).toEqual({ state: 'open' });
    });

    it('sends an empty body without options', async () => {
      answer();

      await IssuesClient.list(PROJECT_ID);

      expect(sentBody()).toEqual({});
    });

    it('maps a 404', async () => {
      fail(404, 'PROJECT_NOT_FOUND');

      await expectAsync(IssuesClient.list(PROJECT_ID))
        .toBeRejectedWith(jasmine.objectContaining({ status: 404, code: 'PROJECT_NOT_FOUND', meta: undefined }));
    });
  });

  describe('.create', () => {
    it('posts the title and body', async () => {
      answer(buildIssue());

      await IssuesClient.create(PROJECT_ID, { title: 'T', body: 'B' });

      expect(sentPath()).toBe(`${base}/create.json`);
      expect(sentBody()).toEqual({ title: 'T', body: 'B' });
    });

    it('omits an undefined body and keeps a null one', async () => {
      answer();
      await IssuesClient.create(PROJECT_ID, { title: 'T' });
      expect(sentBody()).toEqual({ title: 'T' });

      answer();
      await IssuesClient.create(PROJECT_ID, { title: 'T', body: null });
      expect(JSON.parse(globalThis.fetch.calls.argsFor(0)[1].body)).toEqual({ title: 'T', body: null });
    });

    it('maps ISSUES_LIMIT_REACHED and VALIDATION_FAILED details', async () => {
      fail(422, 'ISSUES_LIMIT_REACHED');
      await expectAsync(IssuesClient.create(PROJECT_ID, { title: 'T' }))
        .toBeRejectedWith(jasmine.objectContaining({ code: 'ISSUES_LIMIT_REACHED' }));

      fail(400, 'VALIDATION_FAILED', { details: ['title should not be empty'] });
      await expectAsync(IssuesClient.create(PROJECT_ID, { title: '' }))
        .toBeRejectedWith(jasmine.objectContaining({ details: ['title should not be empty'] }));
    });
  });

  describe('.show', () => {
    it('posts an empty body to the issue show endpoint', async () => {
      answer(buildIssue());

      const issue = await IssuesClient.show(PROJECT_ID, ISSUE_ID);

      expect(sentPath()).toBe(`${issueBase}/show.json`);
      expect(sentBody()).toEqual({});
      expect(issue.id).toBe(ISSUE_ID);
    });

    it('maps a 404', async () => {
      fail(404, 'ISSUE_NOT_FOUND');

      await expectAsync(IssuesClient.show(PROJECT_ID, ISSUE_ID))
        .toBeRejectedWith(jasmine.objectContaining({ status: 404 }));
    });
  });

  describe('.edit', () => {
    it('posts only the given fields', async () => {
      answer();

      await IssuesClient.edit(PROJECT_ID, ISSUE_ID, { state: 'closed' });

      expect(sentPath()).toBe(`${issueBase}/edit.json`);
      expect(sentBody()).toEqual({ state: 'closed' });
    });

    it('posts the title and body', async () => {
      answer();

      await IssuesClient.edit(PROJECT_ID, ISSUE_ID, { title: 'T', body: null });

      expect(sentBody()).toEqual({ title: 'T', body: null });
    });

    it('maps ISSUE_EDIT_RATE_LIMITED with retryAfterSeconds', async () => {
      fail(429, 'ISSUE_EDIT_RATE_LIMITED', { retryAfterSeconds: 12 });

      await expectAsync(IssuesClient.edit(PROJECT_ID, ISSUE_ID, { title: 'T' })).toBeRejectedWith(
        jasmine.objectContaining({ status: 429, code: 'ISSUE_EDIT_RATE_LIMITED', retryAfterSeconds: 12 }),
      );
    });
  });

  describe('.delete', () => {
    it('posts an empty body to the issue delete endpoint', async () => {
      answer({});

      await IssuesClient.delete(PROJECT_ID, ISSUE_ID);

      expect(sentPath()).toBe(`${issueBase}/delete.json`);
      expect(sentBody()).toEqual({});
    });

    it('maps ISSUE_LINKED', async () => {
      fail(409, 'ISSUE_LINKED');

      await expectAsync(IssuesClient.delete(PROJECT_ID, ISSUE_ID))
        .toBeRejectedWith(jasmine.objectContaining({ status: 409, code: 'ISSUE_LINKED' }));
    });
  });

  describe('.import', () => {
    it('posts the GitHub issue number', async () => {
      answer(buildIssue());

      await IssuesClient.import(PROJECT_ID, { number: 12 });

      expect(sentPath()).toBe(`${base}/import.json`);
      expect(sentBody()).toEqual({ number: 12 });
    });

    it('maps GITHUB_ISSUE_ALREADY_LINKED with both ids in meta', async () => {
      const meta = { projectId: PROJECT_ID, issueId: ISSUE_ID };

      fail(409, 'GITHUB_ISSUE_ALREADY_LINKED', { meta });

      await expectAsync(IssuesClient.import(PROJECT_ID, { number: 12 }))
        .toBeRejectedWith(jasmine.objectContaining({ code: 'GITHUB_ISSUE_ALREADY_LINKED', meta }));
    });
  });

  describe('.attach', () => {
    it('posts the number', async () => {
      answer();

      await IssuesClient.attach(PROJECT_ID, ISSUE_ID, { number: 12 });

      expect(sentPath()).toBe(`${issueBase}/attach.json`);
      expect(sentBody()).toEqual({ number: 12 });
    });

    it('posts confirmUpdatedAt when confirming', async () => {
      answer();

      await IssuesClient.attach(PROJECT_ID, ISSUE_ID, { number: 12, confirmUpdatedAt: '2026-11-07T11:00:00.000Z' });

      expect(sentBody()).toEqual({ number: 12, confirmUpdatedAt: '2026-11-07T11:00:00.000Z' });
    });

    it('maps the differences warning meta', async () => {
      const meta = { differences: ['title'], updatedAt: '2026-11-07T11:00:00.000Z' };

      fail(409, 'ISSUE_ATTACH_CONFIRMATION_REQUIRED', { meta });

      await expectAsync(IssuesClient.attach(PROJECT_ID, ISSUE_ID, { number: 12 }))
        .toBeRejectedWith(jasmine.objectContaining({ meta }));
    });
  });

  describe('.unlink', () => {
    it('posts an empty body by default', async () => {
      answer();

      await IssuesClient.unlink(PROJECT_ID, ISSUE_ID);

      expect(sentPath()).toBe(`${issueBase}/unlink.json`);
      expect(sentBody()).toEqual({});
    });

    it('sends discard as discardUnsentChanges', async () => {
      answer({ issue: buildIssue(), droppedUnsentChanges: true });

      await IssuesClient.unlink(PROJECT_ID, ISSUE_ID, { discard: true });

      expect(sentBody()).toEqual({ discardUnsentChanges: true });
    });

    it('maps ISSUE_NOT_LINKED', async () => {
      fail(409, 'ISSUE_NOT_LINKED');

      await expectAsync(IssuesClient.unlink(PROJECT_ID, ISSUE_ID))
        .toBeRejectedWith(jasmine.objectContaining({ code: 'ISSUE_NOT_LINKED' }));
    });
  });

  describe('.refresh', () => {
    it('posts an empty body to the issue refresh endpoint', async () => {
      answer({ issue: buildIssue(), alreadyFresh: false });

      const response = await IssuesClient.refresh(PROJECT_ID, ISSUE_ID);

      expect(sentPath()).toBe(`${issueBase}/refresh.json`);
      expect(sentBody()).toEqual({});
      expect(response.alreadyFresh).toBe(false);
    });

    it('maps ISSUE_LINK_RATE_LIMITED with retryAfterSeconds', async () => {
      fail(429, 'ISSUE_LINK_RATE_LIMITED', { retryAfterSeconds: 9 });

      await expectAsync(IssuesClient.refresh(PROJECT_ID, ISSUE_ID))
        .toBeRejectedWith(jasmine.objectContaining({ retryAfterSeconds: 9 }));
    });
  });

  describe('.retrySync', () => {
    it('posts an empty body to the retry-sync endpoint', async () => {
      answer({ issue: buildIssue() });

      await IssuesClient.retrySync(PROJECT_ID, ISSUE_ID);

      expect(sentPath()).toBe(`${issueBase}/retry-sync.json`);
      expect(sentBody()).toEqual({});
    });

    it('maps GITHUB_CREDENTIAL_UNUSABLE with its reason', async () => {
      fail(409, 'GITHUB_CREDENTIAL_UNUSABLE', { meta: { reason: 'revoked' } });

      await expectAsync(IssuesClient.retrySync(PROJECT_ID, ISSUE_ID))
        .toBeRejectedWith(jasmine.objectContaining({ meta: { reason: 'revoked' } }));
    });
  });
});
