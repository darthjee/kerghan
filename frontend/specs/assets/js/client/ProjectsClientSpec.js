import ProjectsClient from '../../../../assets/js/client/ProjectsClient.js';
import { fetchSequence } from '../../../support/fetchSequence.js';
import { buildFailure, buildProject, PROJECT_ID } from '../../../support/issuesBuilders.js';

describe('ProjectsClient', () => {
  let originalFetch;

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
    it('posts the given fields to the mine endpoint', async () => {
      answer({ projects: [] });

      const response = await ProjectsClient.list({ page: 2, perPage: 20, search: 'ker' });

      expect(sentPath()).toBe('/projects/mine.json');
      expect(globalThis.fetch.calls.argsFor(0)[1].method).toBe('POST');
      expect(sentBody()).toEqual({ page: 2, perPage: 20, search: 'ker' });
      expect(response).toEqual({ projects: [] });
    });

    it('omits undefined fields and an empty search', async () => {
      answer();

      await ProjectsClient.list({ page: 1, search: '' });

      expect(sentBody()).toEqual({ page: 1 });
    });

    it('sends an empty body without options', async () => {
      answer();

      await ProjectsClient.list();

      expect(sentBody()).toEqual({});
    });

    it('rejects with an ApiError on a 400', async () => {
      fail(400, 'VALIDATION_FAILED', { details: ['page must be an integer'] });

      await expectAsync(ProjectsClient.list({ page: 0 })).toBeRejectedWith(jasmine.objectContaining({
        status: 400, code: 'VALIDATION_FAILED', details: ['page must be an integer'], meta: undefined,
      }));
    });
  });

  describe('.create', () => {
    it('posts the name, description and repository ref', async () => {
      answer(buildProject());

      await ProjectsClient.create({ name: 'Kerghan', description: 'Desc', repository: { githubId: 5 } });

      expect(sentPath()).toBe('/projects/create.json');
      expect(sentBody()).toEqual({ name: 'Kerghan', description: 'Desc', repository: { githubId: 5 } });
    });

    it('keeps a null repository and omits an undefined description', async () => {
      answer();

      await ProjectsClient.create({ name: 'Kerghan', repository: null });

      expect(sentBody()).toEqual({ name: 'Kerghan', repository: null });
    });

    it('maps PROJECT_REPOSITORY_TAKEN with its meta', async () => {
      fail(409, 'PROJECT_REPOSITORY_TAKEN', { meta: { projectId: PROJECT_ID } });

      await expectAsync(ProjectsClient.create({ name: 'x' })).toBeRejectedWith(jasmine.objectContaining({
        status: 409, code: 'PROJECT_REPOSITORY_TAKEN', meta: { projectId: PROJECT_ID },
      }));
    });

    it('maps PROJECTS_LIMIT_REACHED', async () => {
      fail(422, 'PROJECTS_LIMIT_REACHED');

      await expectAsync(ProjectsClient.create({ name: 'x' }))
        .toBeRejectedWith(jasmine.objectContaining({ status: 422, code: 'PROJECTS_LIMIT_REACHED' }));
    });
  });

  describe('.createFromRepository', () => {
    it('posts the repository ref and no name by default', async () => {
      answer();

      await ProjectsClient.createFromRepository({ githubId: 5 });

      expect(sentPath()).toBe('/projects/from-repository.json');
      expect(sentBody()).toEqual({ repository: { githubId: 5 } });
    });

    it('posts the name when given', async () => {
      answer();

      await ProjectsClient.createFromRepository({ githubId: 5, name: 'Mine' });

      expect(sentBody()).toEqual({ repository: { githubId: 5 }, name: 'Mine' });
    });

    it('maps PROJECT_NAME_TAKEN', async () => {
      fail(409, 'PROJECT_NAME_TAKEN');

      await expectAsync(ProjectsClient.createFromRepository({ githubId: 5 }))
        .toBeRejectedWith(jasmine.objectContaining({ status: 409, code: 'PROJECT_NAME_TAKEN' }));
    });
  });

  describe('.show', () => {
    it('posts an empty body to the project show endpoint', async () => {
      answer(buildProject());

      const project = await ProjectsClient.show(PROJECT_ID);

      expect(sentPath()).toBe(`/projects/${PROJECT_ID}/show.json`);
      expect(sentBody()).toEqual({});
      expect(project.id).toBe(PROJECT_ID);
    });

    it('maps a 404', async () => {
      fail(404, 'PROJECT_NOT_FOUND');

      await expectAsync(ProjectsClient.show(PROJECT_ID))
        .toBeRejectedWith(jasmine.objectContaining({ status: 404, code: 'PROJECT_NOT_FOUND' }));
    });
  });

  describe('.edit', () => {
    it('posts the changed fields', async () => {
      answer();

      await ProjectsClient.edit(PROJECT_ID, { name: 'New', description: null });

      expect(sentPath()).toBe(`/projects/${PROJECT_ID}/edit.json`);
      expect(sentBody()).toEqual({ name: 'New', description: null });
    });

    it('omits undefined fields', async () => {
      answer();

      await ProjectsClient.edit(PROJECT_ID, { name: 'New' });

      expect(sentBody()).toEqual({ name: 'New' });
    });

    it('maps PROJECT_NAME_TAKEN', async () => {
      fail(409, 'PROJECT_NAME_TAKEN');

      await expectAsync(ProjectsClient.edit(PROJECT_ID, { name: 'x' }))
        .toBeRejectedWith(jasmine.objectContaining({ code: 'PROJECT_NAME_TAKEN' }));
    });
  });

  describe('.setRepository', () => {
    it('posts the repository ref', async () => {
      answer();

      await ProjectsClient.setRepository(PROJECT_ID, { githubId: 7 });

      expect(sentPath()).toBe(`/projects/${PROJECT_ID}/repository.json`);
      expect(sentBody()).toEqual({ repository: { githubId: 7 } });
    });

    it('posts null to detach', async () => {
      answer();

      await ProjectsClient.setRepository(PROJECT_ID, null);

      expect(sentBody()).toEqual({ repository: null });
    });

    it('maps PROJECT_HAS_LINKS with its linkCount', async () => {
      fail(409, 'PROJECT_HAS_LINKS', { meta: { linkCount: 3 } });

      await expectAsync(ProjectsClient.setRepository(PROJECT_ID, null)).toBeRejectedWith(
        jasmine.objectContaining({ code: 'PROJECT_HAS_LINKS', meta: { linkCount: 3 } }),
      );
    });
  });

  describe('.delete', () => {
    it('posts an empty body and answers the unsent count', async () => {
      answer({ unsentIssueCount: 2 });

      const response = await ProjectsClient.delete(PROJECT_ID);

      expect(sentPath()).toBe(`/projects/${PROJECT_ID}/delete.json`);
      expect(sentBody()).toEqual({});
      expect(response).toEqual({ unsentIssueCount: 2 });
    });

    it('maps a 404', async () => {
      fail(404, 'PROJECT_NOT_FOUND');

      await expectAsync(ProjectsClient.delete(PROJECT_ID))
        .toBeRejectedWith(jasmine.objectContaining({ status: 404 }));
    });
  });

  describe('.refresh', () => {
    it('posts an empty body to the project refresh endpoint', async () => {
      answer({ enqueued: 2, skippedFresh: 1 });

      const response = await ProjectsClient.refresh(PROJECT_ID);

      expect(sentPath()).toBe(`/projects/${PROJECT_ID}/refresh.json`);
      expect(response).toEqual({ enqueued: 2, skippedFresh: 1 });
    });

    it('maps GITHUB_RATE_LIMITED with retryAfterSeconds', async () => {
      fail(429, 'GITHUB_RATE_LIMITED', { retryAfterSeconds: 30 });

      await expectAsync(ProjectsClient.refresh(PROJECT_ID)).toBeRejectedWith(
        jasmine.objectContaining({ status: 429, retryAfterSeconds: 30 }),
      );
    });
  });

  describe('path ids (S3)', () => {
    const calls = {
      show: (id) => ProjectsClient.show(id),
      edit: (id) => ProjectsClient.edit(id, { name: 'x' }),
      setRepository: (id) => ProjectsClient.setRepository(id, null),
      delete: (id) => ProjectsClient.delete(id),
      refresh: (id) => ProjectsClient.refresh(id),
    };

    Object.entries(calls).forEach(([name, call]) => {
      it(`${name} rejects a crafted id as not found, without a request`, async () => {
        answer();

        await expectAsync(call('..%2Fadmin'))
          .toBeRejectedWith(jasmine.objectContaining({ status: 404, code: 'NOT_FOUND' }));
        await expectAsync(call('../admin')).toBeRejected();
        expect(globalThis.fetch).not.toHaveBeenCalled();
      });
    });
  });
});
