import RepositoryPickerController, { PICKER_DEBOUNCE_MS, PICKER_PER_PAGE } from '../../../../../../../assets/js/components/resources/projects/repositoryPicker/RepositoryPickerController.js';
import { flushMicrotasks } from '../../../../../../support/flushMicrotasks.js';
import { buildListing, buildRepository } from '../../../../../../support/repositoriesBuilders.js';

describe('RepositoryPickerController', () => {
  let state;
  let setters;
  let client;
  let controller;

  const apply = (key) => jasmine.createSpy(key).and.callFake((value) => { state[key] = value; });
  const listing = (names, total = names.length) => buildListing({
    repositories: names.map((name, index) => buildRepository({ githubId: index + 1, fullName: name })),
    pagination: { page: 1, perPage: 20, total, totalPages: 1 },
  });

  beforeEach(() => {
    jasmine.clock().install();
    state = { search: '', results: [], noneAdded: false, error: null };
    setters = {
      setSearch: apply('search'), setResults: apply('results'), setNoneAdded: apply('noneAdded'), setError: apply('error'),
    };
    client = jasmine.createSpyObj('client', ['list']);
    client.list.and.resolveTo(listing(['a/b']));
    controller = new RepositoryPickerController(setters, client);
  });

  afterEach(() => {
    controller.dispose();
    jasmine.clock().uninstall();
  });

  describe('#start', () => {
    it('lists the added repositories, unsearched, 20 per page', async () => {
      await controller.start();

      expect(client.list).toHaveBeenCalledOnceWith({ filter: 'added', search: '', perPage: PICKER_PER_PAGE });
      expect(state.results.map((row) => row.fullName)).toEqual(['a/b']);
      expect(state.noneAdded).toBe(false);
      expect(state.error).toBeNull();
    });

    it('flags that the user has no added repository when the total is 0', async () => {
      client.list.and.resolveTo(listing([], 0));

      await controller.start();

      expect(state.noneAdded).toBe(true);
    });

    it('shows the load error', async () => {
      client.list.and.rejectWith(new Error('Boom'));

      await controller.start();

      expect(state.error).toBe('Boom');
    });

    it('falls back to a generic load error', async () => {
      client.list.and.rejectWith({});

      await controller.start();

      expect(state.error).toBe('Could not load your repositories.');
    });

    it('leaves state alone when the session expired (undefined answer)', async () => {
      client.list.and.resolveTo(undefined);

      await controller.start();

      expect(setters.setResults).not.toHaveBeenCalled();
    });
  });

  describe('#changeSearch', () => {
    it('shows the typed text at once and searches after the debounce, once', async () => {
      controller.changeSearch('k');
      controller.changeSearch('ke');
      controller.changeSearch('ker');

      expect(state.search).toBe('ker');
      jasmine.clock().tick(PICKER_DEBOUNCE_MS - 1);
      expect(client.list).not.toHaveBeenCalled();

      jasmine.clock().tick(1);
      await flushMicrotasks();

      expect(client.list).toHaveBeenCalledOnceWith({ filter: 'added', search: 'ker', perPage: PICKER_PER_PAGE });
    });

    it('does not re-decide the "none added" hint from a search', async () => {
      state.noneAdded = false;
      client.list.and.resolveTo(listing([], 0));

      controller.changeSearch('zzz');
      jasmine.clock().tick(PICKER_DEBOUNCE_MS);
      await flushMicrotasks();

      expect(setters.setNoneAdded).not.toHaveBeenCalled();
      expect(state.results).toEqual([]);
    });

    it('truncates the typed text to 100 characters', () => {
      controller.changeSearch('x'.repeat(150));

      expect(state.search.length).toBe(100);
    });

    it('ignores an answer arriving after a newer one (out of order)', async () => {
      let answerOld;

      client.list.and.returnValues(
        new Promise((resolve) => { answerOld = resolve; }),
        Promise.resolve(listing(['new/repo'])),
      );

      controller.changeSearch('a');
      jasmine.clock().tick(PICKER_DEBOUNCE_MS);
      controller.changeSearch('ab');
      jasmine.clock().tick(PICKER_DEBOUNCE_MS);
      await flushMicrotasks();
      answerOld(listing(['old/repo']));
      await flushMicrotasks();

      expect(state.results.map((row) => row.fullName)).toEqual(['new/repo']);
    });

    it('ignores a late failure of an outdated search', async () => {
      let failOld;

      client.list.and.returnValues(
        new Promise((_, reject) => { failOld = reject; }),
        Promise.resolve(listing(['new/repo'])),
      );

      controller.changeSearch('a');
      jasmine.clock().tick(PICKER_DEBOUNCE_MS);
      controller.changeSearch('ab');
      jasmine.clock().tick(PICKER_DEBOUNCE_MS);
      await flushMicrotasks();
      failOld(new Error('late'));
      await flushMicrotasks();

      expect(state.error).toBeNull();
    });
  });

  describe('#dispose', () => {
    it('cancels the pending search', async () => {
      controller.changeSearch('x');

      controller.dispose();
      jasmine.clock().tick(PICKER_DEBOUNCE_MS);
      await flushMicrotasks();

      expect(client.list).not.toHaveBeenCalled();
    });

    it('ignores an answer arriving after unmount', async () => {
      const started = controller.start();

      controller.dispose();
      await started;

      expect(setters.setResults).not.toHaveBeenCalled();
    });
  });
});
