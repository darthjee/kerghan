import { expectErrorBody } from '../../auth/tests/support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';
import {
  projectHasLinks,
  projectNameTaken,
  projectNotFound,
  projectRepositoryNotAdded,
  projectRepositoryTaken,
  repositoryNotFound,
} from '../issues-http-errors.js';
import { call, useIssuesTestApp } from './support/build-issues-test-app.js';
import { sampleProject } from './support/fake-projects.service.js';

const PROJECT_ID = '3f2a0000-0000-4000-8000-0000000000c9';
const OTHER_PROJECT = '9b1d0000-0000-4000-8000-0000000000aa';

describe('ProjectsController listing, show, edit, repository and delete routes (e2e)', () => {
  const { ctx } = useIssuesTestApp();

  const post = (path: string, body: Record<string, unknown> = {}) => call(ctx.app, 'post', path, ctx.owner).send(body);

  describe('POST /projects/mine.json', () => {
    it('answers 200 with the service\'s page and passes the defaults', async () => {
      ctx.projects.listing = {
        projects: [sampleProject()],
        pagination: { page: 1, perPage: 50, total: 1, totalPages: 1 },
      };

      const response = await post('/projects/mine.json').expect(200);

      expect(response.body).toEqual(ctx.projects.listing);
      expect(ctx.projects.calls).toEqual([{ method: 'list', userId: ctx.ids.owner, args: [{ page: 1, perPage: 50, search: '' }] }]);
    });

    it('passes the given page, perPage and trimmed search', async () => {
      await post('/projects/mine.json', { page: 3, perPage: 10, search: '  road ' }).expect(200);

      expect(ctx.projects.callsOf('list')[0].args).toEqual([{ page: 3, perPage: 10, search: 'road' }]);
    });
  });

  describe('POST /projects/:projectId/show.json', () => {
    it('answers 200 with the project and passes the uuid', async () => {
      ctx.projects.project = sampleProject({ openIssueCount: 4 });

      const response = await post(`/projects/${PROJECT_ID}/show.json`).expect(200);

      expect(response.body).toEqual(ctx.projects.project);
      expect(ctx.projects.calls).toEqual([{ method: 'show', userId: ctx.ids.owner, args: [PROJECT_ID] }]);
    });

    it('answers the 404 of the service as the standard body', async () => {
      ctx.projects.failWith('show', projectNotFound());

      expectErrorBody(await post(`/projects/${PROJECT_ID}/show.json`), {
        status: 404,
        code: ErrorCodes.NOT_FOUND,
        message: 'Project not found',
      });
    });
  });

  describe('POST /projects/:projectId/edit.json', () => {
    it('answers 200 and passes only the given, normalized fields', async () => {
      await post(`/projects/${PROJECT_ID}/edit.json`, { name: ' New ' }).expect(200);
      await post(`/projects/${PROJECT_ID}/edit.json`, { description: null }).expect(200);
      await post(`/projects/${PROJECT_ID}/edit.json`, { description: '  ' }).expect(200);
      await post(`/projects/${PROJECT_ID}/edit.json`).expect(200);

      expect(ctx.projects.callsOf('edit').map((entry) => entry.args)).toEqual([
        [PROJECT_ID, { name: 'New' }],
        [PROJECT_ID, { description: null }],
        [PROJECT_ID, { description: null }],
        [PROJECT_ID, {}],
      ]);
    });

    it('answers PROJECT_NAME_TAKEN as a 409', async () => {
      ctx.projects.failWith('edit', projectNameTaken());

      expectErrorBody(await post(`/projects/${PROJECT_ID}/edit.json`, { name: 'x' }), {
        status: 409,
        code: ErrorCodes.PROJECT_NAME_TAKEN,
      });
    });
  });

  describe('POST /projects/:projectId/repository.json', () => {
    it('connects or changes with a ref, and detaches with null', async () => {
      await post(`/projects/${PROJECT_ID}/repository.json`, { repository: { githubId: 5 } }).expect(200);
      await post(`/projects/${PROJECT_ID}/repository.json`, { repository: { fullName: 'o/r' } }).expect(200);
      await post(`/projects/${PROJECT_ID}/repository.json`, { repository: null }).expect(200);

      expect(ctx.projects.callsOf('setRepository').map((entry) => entry.args)).toEqual([
        [PROJECT_ID, { repository: { githubId: 5 } }],
        [PROJECT_ID, { repository: { fullName: 'o/r' } }],
        [PROJECT_ID, { repository: null }],
      ]);
    });

    it('answers PROJECT_HAS_LINKS as a 409 carrying meta.linkCount', async () => {
      ctx.projects.failWith('setRepository', projectHasLinks(3));

      const response = await post(`/projects/${PROJECT_ID}/repository.json`, { repository: null });

      expect(response.status).toBe(409);
      expect(response.body.error).toEqual({
        code: ErrorCodes.PROJECT_HAS_LINKS,
        message: "Unlink the project's issues before changing its repository",
        meta: { linkCount: 3 },
      });
    });

    it('answers PROJECT_REPOSITORY_TAKEN with meta.projectId, NOT_ADDED and the Add 404', async () => {
      ctx.projects.failWith('setRepository', projectRepositoryTaken(OTHER_PROJECT));
      const taken = await post(`/projects/${PROJECT_ID}/repository.json`, { repository: { githubId: 5 } });

      expect(taken.body.error).toMatchObject({ code: ErrorCodes.PROJECT_REPOSITORY_TAKEN, meta: { projectId: OTHER_PROJECT } });

      ctx.projects.failWith('setRepository', projectRepositoryNotAdded());
      expectErrorBody(await post(`/projects/${PROJECT_ID}/repository.json`, { repository: { githubId: 5 } }), {
        status: 409,
        code: ErrorCodes.PROJECT_REPOSITORY_NOT_ADDED,
      });

      ctx.projects.failWith('setRepository', repositoryNotFound());
      expectErrorBody(await post(`/projects/${PROJECT_ID}/repository.json`, { repository: { githubId: 5 } }), {
        status: 404,
        code: ErrorCodes.NOT_FOUND,
        message: 'Repository not found',
      });
    });
  });

  describe('POST /projects/:projectId/delete.json', () => {
    it('answers 200 with unsentIssueCount only', async () => {
      ctx.projects.deletion = { unsentIssueCount: 2 };

      const response = await post(`/projects/${PROJECT_ID}/delete.json`).expect(200);

      expect(response.body).toEqual({ unsentIssueCount: 2 });
      expect(ctx.projects.calls).toEqual([{ method: 'delete', userId: ctx.ids.owner, args: [PROJECT_ID] }]);
    });

    it('answers the 404 of a repeat delete', async () => {
      ctx.projects.failWith('delete', projectNotFound());

      expectErrorBody(await post(`/projects/${PROJECT_ID}/delete.json`), { status: 404, code: ErrorCodes.NOT_FOUND });
    });
  });
});
