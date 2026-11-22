import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import ProjectLoadController from '../../../../../../../../assets/js/components/resources/projects/pages/common/ProjectLoadController.js';
import { buildProject, PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';

describe('ProjectLoadController', () => {
  let state;
  let client;
  let controller;

  beforeEach(() => {
    state = { project: null, loadState: null };
    client = jasmine.createSpyObj('client', ['show']);
    client.show.and.resolveTo(buildProject());
    controller = new ProjectLoadController({
      setProject: (value) => { state.project = value; },
      setLoadState: (value) => { state.loadState = value; },
    }, client);
  });

  it('loads the project and clears the load state', async () => {
    await controller.load(PROJECT_ID);

    expect(client.show).toHaveBeenCalledOnceWith(PROJECT_ID);
    expect(state.project.id).toBe(PROJECT_ID);
    expect(state.loadState).toEqual({ loading: false, error: null, notFound: false });
  });

  [404, 400].forEach((status) => {
    it(`shows "not found" for a ${status} (U1)`, async () => {
      client.show.and.rejectWith(new ApiError(status, 'Project not found', 'NOT_FOUND'));

      await controller.load(PROJECT_ID);

      expect(state.loadState).toEqual({ loading: false, error: null, notFound: true });
      expect(state.project).toBeNull();
    });
  });

  it('shows the message of any other failure', async () => {
    client.show.and.rejectWith(new ApiError(500, 'Boom', 'INTERNAL'));

    await controller.load(PROJECT_ID);

    expect(state.loadState).toEqual({ loading: false, error: 'Boom', notFound: false });
  });

  it('falls back to a generic message', async () => {
    client.show.and.rejectWith({});

    await controller.load(PROJECT_ID);

    expect(state.loadState.error).toBe('Could not load the project.');
  });

  it('leaves state alone when the session expired (undefined answer)', async () => {
    client.show.and.resolveTo(undefined);

    await controller.load(PROJECT_ID);

    expect(state.project).toBeNull();
    expect(state.loadState).toBeNull();
  });

  it('retries the same id, showing the loading state meanwhile', async () => {
    client.show.and.rejectWith(new ApiError(500, 'Boom', 'INTERNAL'));
    await controller.load(PROJECT_ID);
    client.show.and.resolveTo(buildProject());

    const retrying = controller.retry();

    expect(state.loadState).toEqual({ loading: true, error: null, notFound: false });
    await retrying;
    expect(client.show).toHaveBeenCalledTimes(2);
    expect(client.show.calls.mostRecent().args).toEqual([PROJECT_ID]);
    expect(state.project).not.toBeNull();
  });

  it('ignores an outdated answer', async () => {
    let answerOld;

    client.show.and.returnValues(
      new Promise((resolve) => { answerOld = resolve; }),
      Promise.resolve(buildProject({ name: 'new' })),
    );

    const first = controller.load(PROJECT_ID);

    await controller.load(PROJECT_ID);
    answerOld(buildProject({ name: 'old' }));
    await first;

    expect(state.project.name).toBe('new');
  });

  it('ignores an answer arriving after unmount', async () => {
    const loading = controller.load(PROJECT_ID);

    controller.dispose();
    await loading;

    expect(state.project).toBeNull();
    expect(state.loadState).toBeNull();
  });

  describe('with the real client (S3)', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      globalThis.fetch = jasmine.createSpy('fetch');
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    ['..%2Fadmin', '../admin', 'abc', undefined].forEach((id) => {
      it(`shows "not found" for ${JSON.stringify(id)} with no request (U1)`, async () => {
        const real = new ProjectLoadController({
          setProject: (value) => { state.project = value; },
          setLoadState: (value) => { state.loadState = value; },
        });

        await real.load(id);

        expect(state.loadState).toEqual({ loading: false, error: null, notFound: true });
        expect(globalThis.fetch).not.toHaveBeenCalled();
      });
    });
  });
});
