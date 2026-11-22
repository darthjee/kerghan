import ProjectNoticeStore from '../../../../../../../../../assets/js/components/resources/projects/ProjectNoticeStore.js';
import { SEARCH_DEBOUNCE_MS } from '../../../../../../../../../assets/js/components/resources/projects/pages/list/controllers/ProjectsController.js';
import { flushMicrotasks } from '../../../../../../../../support/flushMicrotasks.js';
import { buildPagination, buildProject, buildProjectListing } from '../../../../../../../../support/issuesBuilders.js';
import { useProjectsControllerHarness } from '../../../../../../../../support/projectsControllerHarness.js';

describe('ProjectsController', () => {
  const context = useProjectsControllerHarness();

  beforeEach(() => {
    ProjectNoticeStore.take();
    context.client.list.and.resolveTo(buildProjectListing());
  });

  describe('#start', () => {
    it('loads the first page and stores the rows, pagination and load state', async () => {
      await context.buildController().start();

      expect(context.client.list).toHaveBeenCalledOnceWith({ page: 1, search: '' });
      expect(context.state.listing.projects.length).toBe(1);
      expect(context.state.listing.pagination.total).toBe(1);
      expect(context.state.loadState).toEqual({ loading: false, error: null });
    });

    it('hands the one-time deletion notice to the page, once', async () => {
      ProjectNoticeStore.setDeleted(2);

      await context.buildController().start();
      expect(context.state.notice).toEqual([
        'Project deleted.', '2 issues had changes that were not sent to GitHub.',
      ]);

      await context.buildController().start();
      expect(context.state.notice).toBeNull();
    });

    it('does not touch state when the session expired (undefined answer)', async () => {
      context.client.list.and.resolveTo(undefined);

      await context.buildController().start();

      expect(context.setters.setListing).not.toHaveBeenCalled();
      expect(context.setters.setLoadState).not.toHaveBeenCalled();
    });
  });

  describe('load errors', () => {
    it('shows the error message', async () => {
      context.client.list.and.rejectWith(new Error('Server exploded'));

      await context.buildController().start();

      expect(context.state.loadState).toEqual({ loading: false, error: 'Server exploded' });
    });

    it('falls back to a generic message', async () => {
      context.client.list.and.rejectWith({});

      await context.buildController().start();

      expect(context.state.loadState.error).toBe('Could not load your projects.');
    });

    it('retries: shows loading, then the rows', async () => {
      context.client.list.and.rejectWith(new Error('nope'));
      const controller = context.buildController();
      await controller.start();
      context.client.list.and.resolveTo(buildProjectListing());

      const retrying = controller.retry();

      expect(context.state.loadState).toEqual({ loading: true, error: null });
      await retrying;
      expect(context.state.loadState).toEqual({ loading: false, error: null });
      expect(context.state.listing.projects.length).toBe(1);
    });
  });

  describe('search', () => {
    it('updates the query and hash at once, going back to page 1', async () => {
      context.hash = '#/projects?page=3';
      const controller = context.buildController();
      await controller.start();

      controller.changeSearch('ker');

      expect(context.state.query).toEqual({ page: 1, search: 'ker' });
      expect(context.location.replace).toHaveBeenCalledWith('#/projects?search=ker');
    });

    it('reloads once, after the debounce (P2)', async () => {
      const controller = context.buildController();
      await controller.start();
      context.client.list.calls.reset();

      controller.changeSearch('k');
      controller.changeSearch('ke');
      controller.changeSearch('ker');
      jasmine.clock().tick(SEARCH_DEBOUNCE_MS - 1);
      expect(context.client.list).not.toHaveBeenCalled();

      jasmine.clock().tick(1);
      await flushMicrotasks();

      expect(context.client.list).toHaveBeenCalledOnceWith({ page: 1, search: 'ker' });
    });

    it('truncates the typed text to 100 characters', async () => {
      const controller = context.buildController();
      await controller.start();

      controller.changeSearch('x'.repeat(150));

      expect(context.state.query.search).toBe('x'.repeat(100));
    });

    it('ignores an answer that arrives after a newer request (out of order)', async () => {
      const controller = context.buildController();
      await controller.start();
      let answerOld;

      context.client.list.and.returnValues(
        new Promise((resolve) => { answerOld = resolve; }),
        Promise.resolve(buildProjectListing({ projects: [buildProject({ name: 'new' })] })),
      );

      controller.changeSearch('a');
      jasmine.clock().tick(SEARCH_DEBOUNCE_MS);
      controller.changeSearch('ab');
      jasmine.clock().tick(SEARCH_DEBOUNCE_MS);
      await flushMicrotasks();
      answerOld(buildProjectListing({ projects: [buildProject({ name: 'old' })] }));
      await flushMicrotasks();

      expect(context.state.listing.projects.map((project) => project.name)).toEqual(['new']);
    });

    it('ignores a late failure of an outdated request', async () => {
      const controller = context.buildController();
      await controller.start();
      let failOld;

      context.client.list.and.returnValues(
        new Promise((_, reject) => { failOld = reject; }),
        Promise.resolve(buildProjectListing()),
      );

      controller.changeSearch('a');
      jasmine.clock().tick(SEARCH_DEBOUNCE_MS);
      controller.changeSearch('ab');
      jasmine.clock().tick(SEARCH_DEBOUNCE_MS);
      await flushMicrotasks();
      failOld(new Error('late'));
      await flushMicrotasks();

      expect(context.state.loadState.error).toBeNull();
    });
  });

  describe('#changePage', () => {
    it('pushes the page into the hash and reloads it', async () => {
      const controller = context.buildController();
      await controller.start();

      await controller.changePage(2);

      expect(context.location.push).toHaveBeenCalledWith('#/projects?page=2');
      expect(context.client.list).toHaveBeenCalledWith({ page: 2, search: '' });
      expect(context.state.query.page).toBe(2);
    });

    it('cancels a pending debounced search reload', async () => {
      const controller = context.buildController();
      await controller.start();
      controller.changeSearch('x');
      context.client.list.calls.reset();

      await controller.changePage(2);
      jasmine.clock().tick(SEARCH_DEBOUNCE_MS);
      await flushMicrotasks();

      expect(context.client.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('U5: a page past the end, or left empty', () => {
    const emptyPage = (page, totalPages, total) => ({
      projects: [], pagination: buildPagination({ page, totalPages, total }),
    });

    it('jumps to the last non-empty page', async () => {
      context.hash = '#/projects?page=9';
      context.client.list.and.returnValues(
        Promise.resolve(emptyPage(9, 3, 120)),
        Promise.resolve(buildProjectListing({ pagination: buildPagination({ page: 3, totalPages: 3, total: 120 }) })),
      );

      await context.buildController().start();

      expect(context.client.list.calls.allArgs()).toEqual([[{ page: 9, search: '' }], [{ page: 3, search: '' }]]);
      expect(context.state.query.page).toBe(3);
      expect(context.location.replace).toHaveBeenCalledWith('#/projects?page=3');
      expect(context.state.listing.projects.length).toBe(1);
    });

    it('jumps to page 1 when there are no rows at all', async () => {
      context.hash = '#/projects?page=2';
      context.client.list.and.returnValues(
        Promise.resolve(emptyPage(2, 0, 0)),
        Promise.resolve(buildProjectListing({ projects: [], pagination: buildPagination({ total: 0, totalPages: 0 }) })),
      );

      await context.buildController().start();

      expect(context.state.query.page).toBe(1);
      expect(context.client.list).toHaveBeenCalledTimes(2);
      expect(context.state.loadState.loading).toBe(false);
    });

    it('jumps only once, never looping', async () => {
      context.hash = '#/projects?page=2';
      context.client.list.and.resolveTo(emptyPage(2, 5, 5));

      await context.buildController().start();

      expect(context.client.list.calls.count()).toBeLessThanOrEqual(2);
    });

    it('does not jump from an empty first page', async () => {
      context.client.list.and.resolveTo(emptyPage(1, 0, 0));

      await context.buildController().start();

      expect(context.client.list).toHaveBeenCalledTimes(1);
      expect(context.state.listing.projects).toEqual([]);
    });
  });

  describe('#dispose', () => {
    it('cancels the pending search reload', async () => {
      const controller = context.buildController();
      await controller.start();
      context.client.list.calls.reset();
      controller.changeSearch('x');

      controller.dispose();
      jasmine.clock().tick(SEARCH_DEBOUNCE_MS);
      await flushMicrotasks();

      expect(context.client.list).not.toHaveBeenCalled();
    });

    it('ignores an answer arriving after unmount', async () => {
      let answer;

      context.client.list.and.returnValue(new Promise((resolve) => { answer = resolve; }));
      const controller = context.buildController();
      const started = controller.start();

      controller.dispose();
      answer(buildProjectListing());
      await started;

      expect(context.setters.setListing).not.toHaveBeenCalled();
    });
  });
});
