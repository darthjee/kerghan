import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import DirtyFormGuardController from '../../../../../../../../assets/js/components/common/forms/controllers/DirtyFormGuardController.js';
import IssueFormController from '../../../../../../../../assets/js/components/resources/issues/pages/form/IssueFormController.js';
import { MAX_ISSUE_BODY_LENGTH, MAX_ISSUE_TITLE_LENGTH } from '../../../../../../../../assets/js/utils/validation/issueValidators.js';
import { buildIssue, ISSUE_ID, PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';

describe('IssueFormController', () => {
  let state;
  let client;
  let forceLeave;
  let onNotFound;
  let controller;
  const fields = (overrides) => ({
    title: 'Fix the login', body: 'Steps', state: 'open', ...overrides,
  });

  beforeEach(() => {
    state = { fieldErrors: {}, formError: undefined, submitting: [] };
    client = jasmine.createSpyObj('client', ['create', 'edit']);
    client.create.and.resolveTo(buildIssue());
    client.edit.and.resolveTo(buildIssue());
    forceLeave = jasmine.createSpy('forceLeave');
    onNotFound = jasmine.createSpy('onNotFound');
    controller = new IssueFormController({
      setFieldErrors: (value) => {
        state.fieldErrors = typeof value === 'function' ? value(state.fieldErrors) : value;
      },
      setFormError: (value) => { state.formError = value; },
      setSubmitting: (value) => state.submitting.push(value),
    }, onNotFound, client);
  });

  describe('#create', () => {
    it('creates the issue with the trimmed title and the untouched body, then goes to its page', async () => {
      await controller.create(PROJECT_ID, fields({ title: '  Fix  ', body: '  body\n' }), forceLeave);

      expect(client.create).toHaveBeenCalledOnceWith(PROJECT_ID, { title: 'Fix', body: '  body\n' });
      expect(forceLeave).toHaveBeenCalledOnceWith(`#/projects/${PROJECT_ID}/issues/${ISSUE_ID}`);
      expect(state.submitting).toEqual([true, false]);
    });

    it('requires a title, before any call', async () => {
      await controller.create(PROJECT_ID, fields({ title: '   ' }), forceLeave);

      expect(state.fieldErrors).toEqual({ title: { message: 'Title is required' } });
      expect(client.create).not.toHaveBeenCalled();
    });

    it('accepts a title of 256 trimmed code points and rejects 257', async () => {
      await controller.create(PROJECT_ID, fields({ title: ` ${'😀'.repeat(MAX_ISSUE_TITLE_LENGTH)} ` }), forceLeave);
      expect(client.create).toHaveBeenCalledTimes(1);

      await controller.create(PROJECT_ID, fields({ title: 'x'.repeat(MAX_ISSUE_TITLE_LENGTH + 1) }), forceLeave);
      expect(client.create).toHaveBeenCalledTimes(1);
      expect(state.fieldErrors.title.message).toBe('Title must be at most 256 characters');
    });

    it('accepts a body of 65536 code points, never trimmed, and rejects 65537', async () => {
      await controller.create(PROJECT_ID, fields({ body: ' '.repeat(MAX_ISSUE_BODY_LENGTH) }), forceLeave);
      expect(client.create).toHaveBeenCalledTimes(1);

      await controller.create(PROJECT_ID, fields({ body: ' '.repeat(MAX_ISSUE_BODY_LENGTH + 1) }), forceLeave);
      expect(client.create).toHaveBeenCalledTimes(1);
      expect(state.fieldErrors.body.message).toBe('Body must be at most 65536 characters');
    });

    it('shows ISSUES_LIMIT_REACHED at form level', async () => {
      client.create.and.rejectWith(new ApiError(409, 'Too many issues', 'ISSUES_LIMIT_REACHED'));

      await controller.create(PROJECT_ID, fields(), forceLeave);

      expect(state.formError).toEqual({ message: 'Too many issues' });
      expect(forceLeave).not.toHaveBeenCalled();
      expect(state.submitting).toEqual([true, false]);
    });

    it('shows VALIDATION_FAILED with its details', async () => {
      client.create.and.rejectWith(new ApiError(400, 'Invalid', 'VALIDATION_FAILED', ['title is too long']));

      await controller.create(PROJECT_ID, fields(), forceLeave);

      expect(state.formError).toEqual({ message: 'Invalid', details: ['title is too long'] });
    });

    it('reports a 404 as a vanished project', async () => {
      client.create.and.rejectWith(new ApiError(404, 'Not found', 'NOT_FOUND'));

      await controller.create(PROJECT_ID, fields(), forceLeave);

      expect(onNotFound).toHaveBeenCalledTimes(1);
      expect(state.formError).toBeNull();
    });

    it('leaves the form alone when the session expired (undefined answer)', async () => {
      client.create.and.resolveTo(undefined);

      await controller.create(PROJECT_ID, fields(), forceLeave);

      expect(forceLeave).not.toHaveBeenCalled();
      expect(state.formError).toBeNull();
    });

    it('clears the previous form error when it starts', async () => {
      state.formError = { message: 'old' };

      await controller.create(PROJECT_ID, fields(), forceLeave);

      expect(state.formError).toBeNull();
    });
  });

  describe('#save', () => {
    it('saves title, body and state, then goes back to the issue page', async () => {
      await controller.save(PROJECT_ID, ISSUE_ID, fields({ state: 'closed' }), forceLeave);

      expect(client.edit).toHaveBeenCalledOnceWith(
        PROJECT_ID, ISSUE_ID, { title: 'Fix the login', body: 'Steps', state: 'closed' },
      );
      expect(forceLeave).toHaveBeenCalledOnceWith(`#/projects/${PROJECT_ID}/issues/${ISSUE_ID}`);
    });

    it('validates before any call', async () => {
      await controller.save(PROJECT_ID, ISSUE_ID, fields({ title: '' }), forceLeave);

      expect(client.edit).not.toHaveBeenCalled();
      expect(state.fieldErrors.title.message).toBe('Title is required');
    });

    it('shows ISSUE_EDIT_RATE_LIMITED with its retryAfterSeconds, keeping the form', async () => {
      client.edit.and.rejectWith(new ApiError(429, 'Slow down', 'ISSUE_EDIT_RATE_LIMITED', undefined, undefined, 9));

      await controller.save(PROJECT_ID, ISSUE_ID, fields(), forceLeave);

      expect(state.formError).toEqual({ message: 'Slow down', retryAfterSeconds: 9 });
      expect(forceLeave).not.toHaveBeenCalled();
    });

    it('reports a 404 as a vanished issue', async () => {
      client.edit.and.rejectWith(new ApiError(404, 'Not found', 'NOT_FOUND'));

      await controller.save(PROJECT_ID, ISSUE_ID, fields(), forceLeave);

      expect(onNotFound).toHaveBeenCalledTimes(1);
    });
  });

  describe('#fieldChanged', () => {
    it('forgets the error of the edited field only', async () => {
      await controller.create(PROJECT_ID, fields({ title: '', body: 'x'.repeat(MAX_ISSUE_BODY_LENGTH + 1) }), forceLeave);

      controller.fieldChanged('title');

      expect(Object.keys(state.fieldErrors)).toEqual(['body']);
    });
  });

  describe('.isDirty (U11)', () => {
    const initial = fields();

    it('is false for the start values', () => {
      expect(IssueFormController.isDirty(fields(), initial)).toBe(false);
    });

    ['title', 'body', 'state'].forEach((field) => {
      it(`is true once ${field} differs`, () => {
        expect(IssueFormController.isDirty(fields({ [field]: 'changed' }), initial)).toBe(true);
      });
    });

    it('lets a clean form leave silently and makes a dirty one ask first', () => {
      const setPendingHash = jasmine.createSpy('setPendingHash');
      const guard = new DirtyFormGuardController(setPendingHash);

      guard.leave('#/projects', IssueFormController.isDirty(fields(), initial));
      expect(setPendingHash).not.toHaveBeenCalled();

      guard.leave('#/projects', IssueFormController.isDirty(fields({ title: 'x' }), initial));
      expect(setPendingHash).toHaveBeenCalledOnceWith('#/projects');
    });
  });
});
