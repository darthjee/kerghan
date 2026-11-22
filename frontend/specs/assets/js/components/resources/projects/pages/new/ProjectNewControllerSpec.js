import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import ProjectNewController from '../../../../../../../../assets/js/components/resources/projects/pages/new/ProjectNewController.js';
import { buildProject, PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';

describe('ProjectNewController', () => {
  let state;
  let setters;
  let client;
  let forceLeave;
  let controller;

  const failure = (status, code, message, meta, details) => new ApiError(status, message, code, details, undefined, undefined, meta);
  const fields = (overrides = {}) => ({
    name: 'Kerghan', description: 'Desc', repository: { githubId: 5, fullName: 'a/b' }, ...overrides,
  });

  beforeEach(() => {
    state = { fieldErrors: {}, formError: null, submitting: false };
    setters = {
      setFieldErrors: jasmine.createSpy('setFieldErrors').and.callFake((value) => {
        state.fieldErrors = typeof value === 'function' ? value(state.fieldErrors) : value;
      }),
      setFormError: jasmine.createSpy('setFormError').and.callFake((value) => { state.formError = value; }),
      setSubmitting: jasmine.createSpy('setSubmitting').and.callFake((value) => { state.submitting = value; }),
    };
    client = jasmine.createSpyObj('client', ['create']);
    client.create.and.resolveTo(buildProject());
    forceLeave = jasmine.createSpy('forceLeave');
    controller = new ProjectNewController(setters, client);
  });

  describe('.parsePrefill', () => {
    it('starts empty without a query', () => {
      expect(ProjectNewController.parsePrefill('#/projects/new')).toEqual({
        fields: { name: '', description: '', repository: null }, nameTaken: false,
      });
    });

    it('reads the repository, its display name and the name', () => {
      const prefill = ProjectNewController.parsePrefill(
        '#/projects/new?repository=7&repositoryName=a%2Fb&name=a%2Fb',
      );

      expect(prefill.fields).toEqual({ name: 'a/b', description: '', repository: { githubId: 7, fullName: 'a/b' } });
      expect(prefill.nameTaken).toBe(false);
    });

    it('reads the name-taken flag', () => {
      expect(ProjectNewController.parsePrefill('#/projects/new?repository=7&error=name_taken').nameTaken).toBe(true);
    });

    it('falls back to the id when the display name is missing', () => {
      expect(ProjectNewController.parsePrefill('#/projects/new?repository=7').fields.repository.fullName)
        .toBe('Repository #7');
    });

    ['abc', '0', '-3', '1.5', '', '12345678901234567890'].forEach((id) => {
      it(`ignores an invalid repository id (${id})`, () => {
        const prefill = ProjectNewController.parsePrefill(`#/projects/new?repository=${id}&error=name_taken`);

        expect(prefill.fields.repository).toBeNull();
        expect(prefill.nameTaken).toBe(false);
      });
    });

    it('truncates a long name to 100 characters', () => {
      expect(ProjectNewController.parsePrefill(`#/projects/new?name=${'x'.repeat(150)}`).fields.name.length).toBe(100);
    });
  });

  describe('.isDirty', () => {
    const initial = { name: 'a', description: '', repository: null };

    it('is false for unchanged fields', () => {
      expect(ProjectNewController.isDirty({ ...initial }, initial)).toBe(false);
    });

    it('is true when the name, description or repository changed', () => {
      expect(ProjectNewController.isDirty({ ...initial, name: 'b' }, initial)).toBe(true);
      expect(ProjectNewController.isDirty({ ...initial, description: 'x' }, initial)).toBe(true);
      expect(ProjectNewController.isDirty({ ...initial, repository: { githubId: 1 } }, initial)).toBe(true);
    });

    it('compares repositories by id', () => {
      const withRepository = { ...initial, repository: { githubId: 1, fullName: 'a/b' } };

      expect(ProjectNewController.isDirty({ ...withRepository, repository: { githubId: 1, fullName: 'x' } }, withRepository)).toBe(false);
    });
  });

  describe('#fieldChanged', () => {
    it('forgets only that field\'s error', () => {
      state.fieldErrors = { name: { message: 'a' }, repository: { message: 'b' } };

      controller.fieldChanged('name');

      expect(state.fieldErrors).toEqual({ repository: { message: 'b' } });
    });
  });

  describe('#submit', () => {
    it('sends the trimmed name and description and the repository ref, then leaves for the new project', async () => {
      await controller.submit(fields({ name: '  Kerghan ', description: ' Desc ' }), forceLeave);

      expect(client.create).toHaveBeenCalledOnceWith({
        name: 'Kerghan', description: 'Desc', repository: { githubId: 5 },
      });
      expect(forceLeave).toHaveBeenCalledOnceWith(`#/projects/${PROJECT_ID}`);
    });

    it('sends a null repository for "No repository"', async () => {
      await controller.submit(fields({ repository: null }), forceLeave);

      expect(client.create.calls.mostRecent().args[0].repository).toBeNull();
    });

    it('is disabled in flight (U2) and enabled again afterwards', async () => {
      const submitting = [];

      setters.setSubmitting.and.callFake((value) => submitting.push(value));

      await controller.submit(fields(), forceLeave);

      expect(submitting).toEqual([true, false]);
    });

    it('does not call the API when a client-side limit fails', async () => {
      await controller.submit(fields({ name: '   ', description: 'x'.repeat(2001) }), forceLeave);

      expect(client.create).not.toHaveBeenCalled();
      expect(state.fieldErrors.name).toEqual({ message: 'Name is required' });
      expect(state.fieldErrors.description).toEqual({ message: 'Description must be at most 2000 characters' });
      expect(forceLeave).not.toHaveBeenCalled();
    });

    it('stays on the form, with its values, when the session expired (U4)', async () => {
      client.create.and.resolveTo(undefined);

      await controller.submit(fields(), forceLeave);

      expect(forceLeave).not.toHaveBeenCalled();
      expect(state.formError).toBeNull();
      expect(state.submitting).toBe(false);
    });

    it('clears the earlier errors on a new attempt', async () => {
      state.formError = { message: 'old' };
      state.fieldErrors = { name: { message: 'old' } };

      await controller.submit(fields(), forceLeave);

      expect(state.formError).toBeNull();
      expect(state.fieldErrors).toEqual({});
    });

    describe('refusals', () => {
      it('puts PROJECT_NAME_TAKEN on the Name field', async () => {
        client.create.and.rejectWith(failure(409, 'PROJECT_NAME_TAKEN', 'A project with this name already exists'));

        await controller.submit(fields(), forceLeave);

        expect(state.fieldErrors).toEqual({ name: { message: 'A project with this name already exists' } });
        expect(state.formError).toBeNull();
      });

      it('puts PROJECT_REPOSITORY_TAKEN on the Repository field, with the link to the project', async () => {
        client.create.and.rejectWith(failure(409, 'PROJECT_REPOSITORY_TAKEN', 'Taken', { projectId: PROJECT_ID }));

        await controller.submit(fields(), forceLeave);

        expect(state.fieldErrors.repository.link.href).toBe(`#/projects/${PROJECT_ID}`);
      });

      it('puts PROJECT_REPOSITORY_NOT_ADDED on the Repository field', async () => {
        client.create.and.rejectWith(failure(409, 'PROJECT_REPOSITORY_NOT_ADDED', 'Add this repository first'));

        await controller.submit(fields(), forceLeave);

        expect(state.fieldErrors).toEqual({ repository: { message: 'Add this repository first' } });
      });

      it('puts the repository 404 on the Repository field', async () => {
        client.create.and.rejectWith(failure(404, 'NOT_FOUND', 'Repository not found'));

        await controller.submit(fields(), forceLeave);

        expect(state.fieldErrors).toEqual({ repository: { message: 'Repository not found' } });
      });

      it('shows PROJECTS_LIMIT_REACHED as a form-level error', async () => {
        client.create.and.rejectWith(failure(422, 'PROJECTS_LIMIT_REACHED', 'You reached the maximum number of projects'));

        await controller.submit(fields(), forceLeave);

        expect(state.formError).toEqual({ message: 'You reached the maximum number of projects' });
        expect(state.fieldErrors).toEqual({});
      });

      it('lists the VALIDATION_FAILED details at form level', async () => {
        client.create.and.rejectWith(failure(400, 'VALIDATION_FAILED', 'bad', undefined, ['name must be a string']));

        await controller.submit(fields(), forceLeave);

        expect(state.formError).toEqual({ message: 'bad', details: ['name must be a string'] });
      });

      it('words GITHUB_UNAVAILABLE at form level', async () => {
        client.create.and.rejectWith(failure(502, 'GITHUB_UNAVAILABLE', 'api'));

        await controller.submit(fields(), forceLeave);

        expect(state.formError).toEqual({ message: 'GitHub is unavailable right now; try again.' });
      });

      it('keeps the form usable after a refusal', async () => {
        client.create.and.rejectWith(failure(500, 'INTERNAL', 'Boom'));

        await controller.submit(fields(), forceLeave);

        expect(state.submitting).toBe(false);
        expect(forceLeave).not.toHaveBeenCalled();
      });
    });
  });
});
