import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import ProjectDetailsController from '../../../../../../../../assets/js/components/resources/projects/pages/edit/ProjectDetailsController.js';
import { buildProject, PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';

describe('ProjectDetailsController', () => {
  let state;
  let setters;
  let client;
  let onNotFound;
  let forceLeave;
  let controller;

  const failure = (status, code, message, details) => new ApiError(status, message, code, details);

  beforeEach(() => {
    state = { fieldErrors: {}, formError: null, submitting: false };
    setters = {
      setFieldErrors: (value) => { state.fieldErrors = typeof value === 'function' ? value(state.fieldErrors) : value; },
      setFormError: (value) => { state.formError = value; },
      setSubmitting: jasmine.createSpy('setSubmitting').and.callFake((value) => { state.submitting = value; }),
    };
    client = jasmine.createSpyObj('client', ['edit']);
    client.edit.and.resolveTo(buildProject());
    onNotFound = jasmine.createSpy('onNotFound');
    forceLeave = jasmine.createSpy('forceLeave');
    controller = new ProjectDetailsController(setters, onNotFound, client);
  });

  describe('.isDirty', () => {
    it('compares name and description with the start values', () => {
      const initial = { name: 'a', description: 'b' };

      expect(ProjectDetailsController.isDirty({ ...initial }, initial)).toBe(false);
      expect(ProjectDetailsController.isDirty({ ...initial, name: 'x' }, initial)).toBe(true);
      expect(ProjectDetailsController.isDirty({ ...initial, description: 'x' }, initial)).toBe(true);
    });
  });

  describe('#fieldChanged', () => {
    it('forgets only that field\'s error', () => {
      state.fieldErrors = { name: { message: 'a' }, description: { message: 'b' } };

      controller.fieldChanged('description');

      expect(state.fieldErrors).toEqual({ name: { message: 'a' } });
    });
  });

  describe('#save', () => {
    it('sends the trimmed fields and goes back to the project page on a 200', async () => {
      await controller.save(PROJECT_ID, { name: ' New ', description: ' Desc ' }, forceLeave);

      expect(client.edit).toHaveBeenCalledOnceWith(PROJECT_ID, { name: 'New', description: 'Desc' });
      expect(forceLeave).toHaveBeenCalledOnceWith(`#/projects/${PROJECT_ID}`);
    });

    it('makes the call and returns even when nothing changed', async () => {
      await controller.save(PROJECT_ID, { name: 'Kerghan', description: '' }, forceLeave);

      expect(client.edit).toHaveBeenCalledTimes(1);
      expect(forceLeave).toHaveBeenCalledTimes(1);
    });

    it('is in flight while the call runs (U2), then free again', async () => {
      const flags = [];

      setters.setSubmitting.and.callFake((value) => flags.push(value));

      await controller.save(PROJECT_ID, { name: 'a', description: '' }, forceLeave);

      expect(flags).toEqual([true, false]);
    });

    it('does not call the API when a client-side limit fails', async () => {
      await controller.save(PROJECT_ID, { name: '', description: 'x'.repeat(2001) }, forceLeave);

      expect(client.edit).not.toHaveBeenCalled();
      expect(state.fieldErrors.name).toEqual({ message: 'Name is required' });
      expect(state.fieldErrors.description.message).toBe('Description must be at most 2000 characters');
    });

    it('stays on the form when the session expired (U4)', async () => {
      client.edit.and.resolveTo(undefined);

      await controller.save(PROJECT_ID, { name: 'a', description: '' }, forceLeave);

      expect(forceLeave).not.toHaveBeenCalled();
      expect(state.submitting).toBe(false);
    });

    it('shows PROJECT_NAME_TAKEN on the Name field', async () => {
      client.edit.and.rejectWith(failure(409, 'PROJECT_NAME_TAKEN', 'A project with this name already exists'));

      await controller.save(PROJECT_ID, { name: 'a', description: '' }, forceLeave);

      expect(state.fieldErrors).toEqual({ name: { message: 'A project with this name already exists' } });
      expect(forceLeave).not.toHaveBeenCalled();
    });

    it('lists VALIDATION_FAILED details at form level', async () => {
      client.edit.and.rejectWith(failure(400, 'VALIDATION_FAILED', 'bad', ['one']));

      await controller.save(PROJECT_ID, { name: 'a', description: '' }, forceLeave);

      expect(state.formError).toEqual({ message: 'bad', details: ['one'] });
    });

    it('words GITHUB_UNAVAILABLE at form level', async () => {
      client.edit.and.rejectWith(failure(502, 'GITHUB_UNAVAILABLE', 'api'));

      await controller.save(PROJECT_ID, { name: 'a', description: '' }, forceLeave);

      expect(state.formError.message).toBe('GitHub is unavailable right now; try again.');
    });

    it('hands a project 404 to onNotFound (U1)', async () => {
      client.edit.and.rejectWith(failure(404, 'NOT_FOUND', 'Project not found'));

      await controller.save(PROJECT_ID, { name: 'a', description: '' }, forceLeave);

      expect(onNotFound).toHaveBeenCalledTimes(1);
      expect(state.formError).toBeNull();
    });
  });
});
