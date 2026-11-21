import { expectErrorBody } from '../../auth/tests/support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';
import {
  projectNameTaken,
  projectRepositoryNotAdded,
  projectRepositoryTaken,
  projectsLimitReached,
  repositoryNotFound,
} from '../issues-http-errors.js';
import { call, useIssuesTestApp } from './support/build-issues-test-app.js';
import { sampleProject } from './support/fake-projects.service.js';

const OTHER_PROJECT = '9b1d0000-0000-4000-8000-0000000000aa';

describe('ProjectsController creation routes (e2e)', () => {
  const { ctx } = useIssuesTestApp();

  const create = (body: Record<string, unknown>) => call(ctx.app, 'post', '/projects/create.json', ctx.owner).send(body);
  const shortcut = (body: Record<string, unknown>) => call(ctx.app, 'post', '/projects/from-repository.json', ctx.owner).send(body);

  describe('POST /projects/create.json', () => {
    it('answers 201 with the project and passes the validated input to the explicit path', async () => {
      ctx.projects.creation = { status: 201, project: sampleProject({ name: 'Roadmap' }) };

      const response = await create({ name: '  Roadmap ', description: ' notes ', repository: { fullName: 'darthjee/kerghan' } }).expect(201);

      expect(response.body).toEqual(sampleProject({ name: 'Roadmap' }));
      expect(ctx.projects.calls).toEqual([{
        method: 'create',
        userId: ctx.ids.owner,
        args: [{ name: 'Roadmap', description: 'notes', repository: { fullName: 'darthjee/kerghan' } }, 'explicit'],
      }]);
    });

    it('makes a non-code project without a repository, and stores a blank description as none', async () => {
      await create({ name: 'Plain', description: '   ' }).expect(201);
      await create({ name: 'Plain', repository: null, description: null }).expect(201);

      expect(ctx.projects.callsOf('create').map((entry) => entry.args[0])).toEqual([
        { name: 'Plain', description: null, repository: null },
        { name: 'Plain', description: null, repository: null },
      ]);
    });

    it.each([
      ['PROJECTS_LIMIT_REACHED', projectsLimitReached(), ErrorCodes.PROJECTS_LIMIT_REACHED, 'You reached the maximum number of projects'],
      ['PROJECT_NAME_TAKEN', projectNameTaken(), ErrorCodes.PROJECT_NAME_TAKEN, 'A project with this name already exists'],
      ['PROJECT_REPOSITORY_NOT_ADDED', projectRepositoryNotAdded(), ErrorCodes.PROJECT_REPOSITORY_NOT_ADDED, 'Add this repository first'],
    ])('answers %s as a 409 without meta', async (_name, error, code, message) => {
      ctx.projects.failWith('create', error);

      expectErrorBody(await create({ name: 'x' }), { status: 409, code, message });
    });

    it('answers PROJECT_REPOSITORY_TAKEN as a 409 with meta.projectId only', async () => {
      ctx.projects.failWith('create', projectRepositoryTaken(OTHER_PROJECT));

      const response = await create({ name: 'x', repository: { githubId: 1 } });

      expect(response.status).toBe(409);
      expect(response.body.error).toEqual({
        code: ErrorCodes.PROJECT_REPOSITORY_TAKEN,
        message: 'This repository already has a project',
        meta: { projectId: OTHER_PROJECT },
      });
    });

    it('answers the Add 404 for an unknown repository', async () => {
      ctx.projects.failWith('create', repositoryNotFound());

      expectErrorBody(await create({ name: 'x', repository: { githubId: 1 } }), {
        status: 404,
        code: ErrorCodes.NOT_FOUND,
        message: 'Repository not found',
      });
    });
  });

  describe('POST /projects/from-repository.json', () => {
    it('answers 201 for a new project', async () => {
      ctx.projects.creation = { status: 201, project: sampleProject() };

      const response = await shortcut({ repository: { githubId: 7 } }).expect(201);

      expect(response.body).toEqual(sampleProject());
      expect(ctx.projects.callsOf('create')[0].args).toEqual([{ repository: { githubId: 7 }, description: null }, 'shortcut']);
    });

    it('answers 200 for the repository\'s existing project', async () => {
      ctx.projects.creation = { status: 200, project: sampleProject({ openIssueCount: 3 }) };

      const response = await shortcut({ repository: { fullName: 'darthjee/kerghan' }, name: 'ignored' }).expect(200);

      expect(response.body.openIssueCount).toBe(3);
      expect(ctx.projects.callsOf('create')[0].args).toEqual([
        { repository: { fullName: 'darthjee/kerghan' }, name: 'ignored', description: null },
        'shortcut',
      ]);
    });

    it('answers PROJECT_NAME_TAKEN and PROJECT_REPOSITORY_NOT_ADDED as 409s', async () => {
      ctx.projects.failWith('create', projectNameTaken());
      expectErrorBody(await shortcut({ repository: { githubId: 7 } }), { status: 409, code: ErrorCodes.PROJECT_NAME_TAKEN });

      ctx.projects.failWith('create', projectRepositoryNotAdded());
      expectErrorBody(await shortcut({ repository: { githubId: 7 } }), { status: 409, code: ErrorCodes.PROJECT_REPOSITORY_NOT_ADDED });
    });
  });
});
