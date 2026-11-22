import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import IssueLoadController from '../../../../../../../../assets/js/components/resources/issues/pages/common/IssueLoadController.js';
import {
  buildIssue, buildProject, ISSUE_ID, PROJECT_ID,
} from '../../../../../../../support/issuesBuilders.js';

describe('IssueLoadController', () => {
  let state;
  let projects;
  let issues;
  let controller;

  beforeEach(() => {
    state = { project: null, issue: null, loadState: null };
    projects = jasmine.createSpyObj('projects', ['show']);
    issues = jasmine.createSpyObj('issues', ['show']);
    projects.show.and.resolveTo(buildProject());
    issues.show.and.resolveTo(buildIssue());
    controller = new IssueLoadController({
      setProject: (value) => { state.project = value; },
      setIssue: (value) => { state.issue = value; },
      setLoadState: (value) => { state.loadState = value; },
    }, projects, issues);
  });

  it('loads the project and the issue, and clears the load state', async () => {
    await controller.load(PROJECT_ID, ISSUE_ID);

    expect(projects.show).toHaveBeenCalledOnceWith(PROJECT_ID);
    expect(issues.show).toHaveBeenCalledOnceWith(PROJECT_ID, ISSUE_ID);
    expect(state.project.id).toBe(PROJECT_ID);
    expect(state.issue.id).toBe(ISSUE_ID);
    expect(state.loadState).toEqual({ loading: false, error: null, notFound: null });
  });

  [404, 400].forEach((status) => {
    it(`shows "Project not found" for a ${status} on the project, without loading the issue (U1)`, async () => {
      projects.show.and.rejectWith(new ApiError(status, 'Project not found', 'NOT_FOUND'));

      await controller.load(PROJECT_ID, ISSUE_ID);

      expect(state.loadState).toEqual({ loading: false, error: null, notFound: 'project' });
      expect(issues.show).not.toHaveBeenCalled();
      expect(state.issue).toBeNull();
    });

    it(`shows "Issue not found" for a ${status} on the issue (U1)`, async () => {
      issues.show.and.rejectWith(new ApiError(status, 'Issue not found', 'NOT_FOUND'));

      await controller.load(PROJECT_ID, ISSUE_ID);

      expect(state.loadState).toEqual({ loading: false, error: null, notFound: 'issue' });
      expect(state.issue).toBeNull();
    });
  });

  it('makes no call for a malformed id (S3): the client rejects as not found', async () => {
    projects.show.and.rejectWith(new ApiError(404, 'Not found', 'NOT_FOUND'));

    await controller.load('..%2Fadmin', ISSUE_ID);

    expect(state.loadState.notFound).toBe('project');
  });

  it('shows the message of any other failure', async () => {
    issues.show.and.rejectWith(new ApiError(500, 'Boom', 'INTERNAL'));

    await controller.load(PROJECT_ID, ISSUE_ID);

    expect(state.loadState).toEqual({ loading: false, error: 'Boom', notFound: null });
  });

  it('falls back to a generic message', async () => {
    projects.show.and.rejectWith({});

    await controller.load(PROJECT_ID, ISSUE_ID);

    expect(state.loadState.error).toBe('Could not load the issue.');
  });

  it('leaves state alone when the session expired on either call (undefined answer)', async () => {
    projects.show.and.resolveTo(undefined);
    await controller.load(PROJECT_ID, ISSUE_ID);

    projects.show.and.resolveTo(buildProject());
    issues.show.and.resolveTo(undefined);
    await controller.load(PROJECT_ID, ISSUE_ID);

    expect(state).toEqual({ project: null, issue: null, loadState: null });
  });

  it('retries the same ids, showing the loading state meanwhile', async () => {
    issues.show.and.rejectWith(new ApiError(500, 'Boom', 'INTERNAL'));
    await controller.load(PROJECT_ID, ISSUE_ID);
    issues.show.and.resolveTo(buildIssue());

    const retrying = controller.retry();

    expect(state.loadState).toEqual({ loading: true, error: null, notFound: null });
    await retrying;
    expect(issues.show).toHaveBeenCalledWith(PROJECT_ID, ISSUE_ID);
    expect(state.loadState).toEqual({ loading: false, error: null, notFound: null });
  });

  it('ignores an answer of an older load', async () => {
    let answerOld;

    projects.show.and.returnValues(
      new Promise((resolve) => { answerOld = resolve; }),
      Promise.resolve(buildProject({ name: 'new' })),
    );

    const older = controller.load(PROJECT_ID, ISSUE_ID);

    await controller.load(PROJECT_ID, ISSUE_ID);
    answerOld(buildProject({ name: 'old' }));
    await older;

    expect(state.project.name).toBe('new');
  });

  it('ignores answers and failures after dispose', async () => {
    projects.show.and.rejectWith(new ApiError(500, 'Boom', 'INTERNAL'));

    const loading = controller.load(PROJECT_ID, ISSUE_ID);

    controller.dispose();
    await loading;

    expect(state.loadState).toBeNull();
  });
});
