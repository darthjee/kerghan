import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import ProjectRepositoryController from '../../../../../../../../assets/js/components/resources/projects/pages/edit/ProjectRepositoryController.js';
import { buildProject, PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';

describe('ProjectRepositoryController', () => {
  let state;
  let client;
  let onProjectChange;
  let onNotFound;
  let controller;

  const failure = (status, code, message, meta) => new ApiError(status, message, code, undefined, undefined, undefined, meta);

  beforeEach(() => {
    state = { picking: false, confirmingDetach: false, pending: false, error: null };
    const apply = (key) => (value) => { state[key] = value; };

    client = jasmine.createSpyObj('client', ['setRepository']);
    client.setRepository.and.resolveTo(buildProject());
    onProjectChange = jasmine.createSpy('onProjectChange');
    onNotFound = jasmine.createSpy('onNotFound');
    controller = new ProjectRepositoryController(
      {
        setPicking: apply('picking'), setConfirmingDetach: apply('confirmingDetach'), setPending: apply('pending'), setError: apply('error'),
      },
      { onProjectChange, onNotFound },
      client,
    );
  });

  describe('the picker', () => {
    it('opens, forgetting the last error, and closes without a call', () => {
      state.error = { message: 'old' };

      controller.openPicker();
      expect(state).toEqual(jasmine.objectContaining({ picking: true, error: null }));

      controller.closePicker();
      expect(state.picking).toBe(false);
      expect(client.setRepository).not.toHaveBeenCalled();
    });
  });

  describe('#pick', () => {
    it('connects the picked repository at once and reports the updated project', async () => {
      const updated = buildProject({ name: 'Updated' });

      client.setRepository.and.resolveTo(updated);
      controller.openPicker();

      await controller.pick(PROJECT_ID, { githubId: 9, fullName: 'a/b' });

      expect(client.setRepository).toHaveBeenCalledOnceWith(PROJECT_ID, { githubId: 9 });
      expect(onProjectChange).toHaveBeenCalledOnceWith(updated);
      expect(state.picking).toBe(false);
      expect(state.pending).toBe(false);
    });

    it('is in flight while the call runs (U2)', async () => {
      const flags = [];
      const calls = new ProjectRepositoryController(
        { setPicking: () => undefined, setConfirmingDetach: () => undefined, setPending: (value) => flags.push(value), setError: () => undefined },
        { onProjectChange, onNotFound },
        client,
      );

      await calls.pick(PROJECT_ID, { githubId: 9 });

      expect(flags).toEqual([true, false]);
    });

    it('ignores a null pick', async () => {
      await controller.pick(PROJECT_ID, null);

      expect(client.setRepository).not.toHaveBeenCalled();
    });

    it('leaves everything alone when the session expired (undefined answer)', async () => {
      client.setRepository.and.resolveTo(undefined);
      controller.openPicker();

      await controller.pick(PROJECT_ID, { githubId: 9 });

      expect(onProjectChange).not.toHaveBeenCalled();
      expect(state.picking).toBe(true);
    });

    describe('refusals show in the section, keeping the picker open', () => {
      it('shows PROJECT_HAS_LINKS with meta.linkCount', async () => {
        client.setRepository.and.rejectWith(failure(409, 'PROJECT_HAS_LINKS', 'api', { linkCount: 4 }));
        controller.openPicker();

        await controller.pick(PROJECT_ID, { githubId: 9 });

        expect(state.error).toEqual({ message: '4 linked issues use this repository; unlink them before changing it' });
        expect(state.picking).toBe(true);
        expect(onProjectChange).not.toHaveBeenCalled();
      });

      it('shows PROJECT_REPOSITORY_TAKEN with the link', async () => {
        client.setRepository.and.rejectWith(failure(409, 'PROJECT_REPOSITORY_TAKEN', 'Taken', { projectId: PROJECT_ID }));

        await controller.pick(PROJECT_ID, { githubId: 9 });

        expect(state.error.link.href).toBe(`#/projects/${PROJECT_ID}`);
      });

      it('shows PROJECT_REPOSITORY_NOT_ADDED and the repository 404', async () => {
        client.setRepository.and.rejectWith(failure(409, 'PROJECT_REPOSITORY_NOT_ADDED', 'Add this repository first'));
        await controller.pick(PROJECT_ID, { githubId: 9 });
        expect(state.error.message).toBe('Add this repository first');

        client.setRepository.and.rejectWith(failure(404, 'NOT_FOUND', 'Repository not found'));
        await controller.pick(PROJECT_ID, { githubId: 9 });
        expect(state.error.message).toBe('Repository not found');
        expect(onNotFound).not.toHaveBeenCalled();
      });

      it('words PROJECT_REPOSITORY_CHANGED', async () => {
        client.setRepository.and.rejectWith(failure(409, 'PROJECT_REPOSITORY_CHANGED', 'api'));

        await controller.pick(PROJECT_ID, { githubId: 9 });

        expect(state.error.message).toBe('The project\'s repository changed; try again.');
      });

      it('hands a project 404 to onNotFound (U1)', async () => {
        client.setRepository.and.rejectWith(failure(404, 'NOT_FOUND', 'Project not found'));

        await controller.pick(PROJECT_ID, { githubId: 9 });

        expect(onNotFound).toHaveBeenCalledTimes(1);
        expect(state.error).toBeNull();
      });
    });
  });

  describe('Detach', () => {
    it('opens and closes the confirmation, forgetting the last error when opening', () => {
      state.error = { message: 'old' };

      controller.confirmDetach(true);
      expect(state).toEqual(jasmine.objectContaining({ confirmingDetach: true, error: null }));

      state.error = { message: 'kept' };
      controller.confirmDetach(false);
      expect(state).toEqual(jasmine.objectContaining({ confirmingDetach: false, error: { message: 'kept' } }));
    });

    it('detaches with null at once, closing the confirmation', async () => {
      const updated = buildProject({ repository: null });

      client.setRepository.and.resolveTo(updated);
      controller.confirmDetach(true);

      await controller.detach(PROJECT_ID);

      expect(client.setRepository).toHaveBeenCalledOnceWith(PROJECT_ID, null);
      expect(onProjectChange).toHaveBeenCalledOnceWith(updated);
      expect(state.confirmingDetach).toBe(false);
    });

    it('shows PROJECT_HAS_LINKS in the section and closes the confirmation', async () => {
      client.setRepository.and.rejectWith(failure(409, 'PROJECT_HAS_LINKS', 'api', { linkCount: 2 }));
      controller.confirmDetach(true);

      await controller.detach(PROJECT_ID);

      expect(state.error.message).toBe('2 linked issues use this repository; unlink them before changing it');
      expect(state.confirmingDetach).toBe(false);
    });
  });
});
