import IssuesClient from '../../../../assets/js/client/IssuesClient.js';
import { fetchSequence } from '../../../support/fetchSequence.js';
import { ISSUE_ID, PROJECT_ID } from '../../../support/issuesBuilders.js';

describe('IssuesClient', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: {} }]);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('path ids (S3)', () => {
    const projectCalls = {
      list: (id) => IssuesClient.list(id),
      create: (id) => IssuesClient.create(id, { title: 'T' }),
      import: (id) => IssuesClient.import(id, { number: 1 }),
    };
    const issueCalls = {
      show: (p, i) => IssuesClient.show(p, i),
      edit: (p, i) => IssuesClient.edit(p, i, { title: 'T' }),
      delete: (p, i) => IssuesClient.delete(p, i),
      attach: (p, i) => IssuesClient.attach(p, i, { number: 1 }),
      unlink: (p, i) => IssuesClient.unlink(p, i),
      refresh: (p, i) => IssuesClient.refresh(p, i),
      retrySync: (p, i) => IssuesClient.retrySync(p, i),
    };

    Object.entries(projectCalls).forEach(([name, call]) => {
      it(`${name} rejects a crafted project id as not found, without a request`, async () => {
        await expectAsync(call('..%2Fadmin'))
          .toBeRejectedWith(jasmine.objectContaining({ status: 404, code: 'NOT_FOUND' }));
        expect(globalThis.fetch).not.toHaveBeenCalled();
      });
    });

    Object.entries(issueCalls).forEach(([name, call]) => {
      it(`${name} rejects a crafted project or issue id as not found, without a request`, async () => {
        await expectAsync(call('..%2Fadmin', ISSUE_ID)).toBeRejectedWith(jasmine.objectContaining({ status: 404 }));
        await expectAsync(call(PROJECT_ID, '../x')).toBeRejectedWith(jasmine.objectContaining({ status: 404 }));
        expect(globalThis.fetch).not.toHaveBeenCalled();
      });
    });
  });
});
