import ProjectNoticeStore from '../../../../../../../../../assets/js/components/resources/projects/ProjectNoticeStore.js';
import { buildProjectListing } from '../../../../../../../../support/issuesBuilders.js';
import { useProjectsControllerHarness } from '../../../../../../../../support/projectsControllerHarness.js';

describe('ProjectsController hash query', () => {
  const context = useProjectsControllerHarness();

  beforeEach(() => {
    ProjectNoticeStore.take();
    context.client.list.and.resolveTo(buildProjectListing());
  });

  describe('#start', () => {
    it('restores search and page from the hash', async () => {
      context.hash = '#/projects?search=ker&page=2';

      await context.buildController().start();

      expect(context.client.list).toHaveBeenCalledWith({ page: 2, search: 'ker' });
      expect(context.state.query).toEqual({ page: 2, search: 'ker' });
      expect(context.location.replace).not.toHaveBeenCalled();
    });

    ['-1', '0', 'abc', '1.5', ''].forEach((page) => {
      it(`normalizes page=${page} to 1 before calling (U6)`, async () => {
        context.hash = `#/projects?page=${page}`;

        await context.buildController().start();

        expect(context.client.list).toHaveBeenCalledWith({ page: 1, search: '' });
      });
    });

    it('truncates a search over 100 characters before calling (U6)', async () => {
      context.hash = `#/projects?search=${'x'.repeat(150)}`;

      await context.buildController().start();

      expect(context.client.list).toHaveBeenCalledWith({ page: 1, search: 'x'.repeat(100) });
    });

    it('writes the normalized query back to the hash', async () => {
      context.hash = '#/projects?page=-1&search=a&junk=1';

      await context.buildController().start();

      expect(context.location.replace).toHaveBeenCalledWith('#/projects?search=a');
    });

    it('leaves a foreign hash alone', async () => {
      context.hash = '#/repositories?page=-1';

      await context.buildController().start();

      expect(context.location.replace).not.toHaveBeenCalled();
    });
  });

  describe('#handleHashChange', () => {
    it('adopts a changed query (Back or Forward) and reloads', async () => {
      const controller = context.buildController();
      await controller.start();
      context.client.list.calls.reset();

      context.hash = '#/projects?search=back&page=2';
      await controller.handleHashChange();

      expect(context.state.query).toEqual({ page: 2, search: 'back' });
      expect(context.client.list).toHaveBeenCalledOnceWith({ page: 2, search: 'back' });
    });

    it('ignores a hash whose query is already shown', async () => {
      const controller = context.buildController();
      await controller.start();
      context.client.list.calls.reset();

      await controller.handleHashChange();

      expect(context.client.list).not.toHaveBeenCalled();
    });

    it('ignores a hash that already left the list, without rewriting it', async () => {
      const controller = context.buildController();
      await controller.start();
      context.client.list.calls.reset();
      context.location.replace.calls.reset();

      context.hash = '#/repositories?page=3';
      await controller.handleHashChange();

      expect(context.client.list).not.toHaveBeenCalled();
      expect(context.location.replace).not.toHaveBeenCalled();
    });
  });
});
