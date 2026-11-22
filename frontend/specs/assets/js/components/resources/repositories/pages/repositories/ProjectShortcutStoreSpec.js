import ProjectShortcutStore from '../../../../../../../../assets/js/components/resources/repositories/pages/repositories/ProjectShortcutStore.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import { PROJECT_ID, buildProject } from '../../../../../../../support/issuesBuilders.js';

const noop = Function.prototype;

describe('ProjectShortcutStore', () => {
  const repository = { githubId: 7, fullName: 'darthjee/kerghan' };
  let published;
  let client;
  let location;
  let store;

  const failure = (status, code, message, meta) => new ApiError(status, message, code, undefined, undefined, undefined, meta);

  beforeEach(() => {
    published = new Map();
    client = jasmine.createSpyObj('client', ['createFromRepository']);
    location = jasmine.createSpyObj('location', ['push']);
    store = new ProjectShortcutStore((states) => { published = states; }, client, location);
  });

  it('calls the shortcut route with the githubId and no name', async () => {
    client.createFromRepository.and.resolveTo(buildProject());

    await store.open(repository);

    expect(client.createFromRepository).toHaveBeenCalledOnceWith({ githubId: 7 });
  });

  it('shows a pending state while the call is in flight', () => {
    client.createFromRepository.and.returnValue(new Promise(noop));

    store.open(repository);

    expect(published.get(7)).toEqual({ status: 'pending' });
  });

  it('navigates to the project page and clears the state on a 201 or a 200 alike', async () => {
    client.createFromRepository.and.resolveTo(buildProject());

    await store.open(repository);

    expect(location.push).toHaveBeenCalledOnceWith(`#/projects/${PROJECT_ID}`);
    expect(published.has(7)).toBe(false);
  });

  it('does not navigate when the session expired (undefined answer)', async () => {
    client.createFromRepository.and.resolveTo(undefined);

    await store.open(repository);

    expect(location.push).not.toHaveBeenCalled();
    expect(published.has(7)).toBe(false);
  });

  it('opens the prefilled form with the name-taken error on PROJECT_NAME_TAKEN', async () => {
    client.createFromRepository.and.rejectWith(failure(409, 'PROJECT_NAME_TAKEN', 'taken'));

    await store.open(repository);

    expect(location.push).toHaveBeenCalledOnceWith(
      '#/projects/new?repository=7&repositoryName=darthjee%2Fkerghan&name=darthjee%2Fkerghan&error=name_taken',
    );
    expect(published.has(7)).toBe(false);
  });

  [
    ['PROJECTS_LIMIT_REACHED', 422, 'You reached the maximum number of projects'],
    ['PROJECT_REPOSITORY_NOT_ADDED', 409, 'Add this repository first'],
    ['NOT_FOUND', 404, 'Repository not found'],
  ].forEach(([code, status, message]) => {
    it(`shows ${code} inline, without navigating`, async () => {
      client.createFromRepository.and.rejectWith(failure(status, code, message));

      await store.open(repository);

      expect(published.get(7)).toEqual({ status: 'error', message });
      expect(location.push).not.toHaveBeenCalled();
    });
  });

  it('keeps the link of a refusal that has one', async () => {
    client.createFromRepository.and.rejectWith(
      failure(409, 'PROJECT_REPOSITORY_TAKEN', 'Taken', { projectId: PROJECT_ID }),
    );

    await store.open(repository);

    expect(published.get(7).link.href).toBe(`#/projects/${PROJECT_ID}`);
  });

  it('forgets every row on clearAll', () => {
    client.createFromRepository.and.returnValue(new Promise(noop));
    store.open(repository);

    store.clearAll();

    expect(published.size).toBe(0);
  });
});
