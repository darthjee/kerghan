import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import DirtyFormGuardController from '../../../../../../../../assets/js/components/common/forms/controllers/DirtyFormGuardController.js';
import IssueFormController from '../../../../../../../../assets/js/components/resources/issues/pages/form/IssueFormController.js';
import { MAX_ISSUE_BODY_LENGTH, MAX_ISSUE_TITLE_LENGTH } from '../../../../../../../../assets/js/utils/validation/issueValidators.js';
import SavedIssueSignal from '../../../../../../../../assets/js/components/resources/issues/sync/savedIssueSignal.js';
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
    client = jasmine.createSpyObj('client', ['create', 'edit', 'show']);
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
      setChangedIssue: (value) => { state.changedIssue = value; },
    }, onNotFound, client);
  });

  afterEach(() => {
    SavedIssueSignal.consume(ISSUE_ID);
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

    it('S4: records the saved issue in the one-shot signal (memory only) before leaving', async () => {
      const saved = buildIssue({ title: 'saved' });

      client.edit.and.resolveTo(saved);
      forceLeave.and.callFake(() => {
        expect(SavedIssueSignal.consume(ISSUE_ID)).toBe(saved);
        SavedIssueSignal.record(ISSUE_ID, saved);
      });

      await controller.save(PROJECT_ID, ISSUE_ID, fields(), forceLeave);

      expect(SavedIssueSignal.consume(ISSUE_ID)).toBe(saved);
    });

    it('does not record the signal when the save is refused', async () => {
      client.edit.and.rejectWith(new ApiError(500, 'Boom', 'INTERNAL'));

      await controller.save(PROJECT_ID, ISSUE_ID, fields(), forceLeave);

      expect(SavedIssueSignal.consume(ISSUE_ID)).toBeUndefined();
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

  describe('#create and the signal', () => {
    it('does not record the saved-issue signal (a new issue is unlinked)', async () => {
      await controller.create(PROJECT_ID, fields(), forceLeave);

      expect(SavedIssueSignal.consume(ISSUE_ID)).toBeUndefined();
    });
  });

  describe('U10: #checkChanged (the focus re-read)', () => {
    const loadedAt = '2026-11-07T11:00:00.000Z';

    it('U10: hands on an issue whose updatedAt is later, touching no field', async () => {
      const fresh = buildIssue({ updatedAt: '2026-11-07T12:00:00.000Z' });

      client.show.and.resolveTo(fresh);

      await controller.checkChanged(PROJECT_ID, ISSUE_ID, loadedAt);

      expect(client.show).toHaveBeenCalledOnceWith(PROJECT_ID, ISSUE_ID);
      expect(state.changedIssue).toBe(fresh);
      expect(state.fieldErrors).toEqual({});
      expect(state.formError).toBeUndefined();
    });

    it('U10: stays quiet when updatedAt is unchanged', async () => {
      client.show.and.resolveTo(buildIssue({ updatedAt: loadedAt }));

      await controller.checkChanged(PROJECT_ID, ISSUE_ID, loadedAt);

      expect(state.changedIssue).toBeUndefined();
    });

    it('U10: stays quiet when updatedAt is older', async () => {
      client.show.and.resolveTo(buildIssue({ updatedAt: '2026-11-07T09:00:00.000Z' }));

      await controller.checkChanged(PROJECT_ID, ISSUE_ID, loadedAt);

      expect(state.changedIssue).toBeUndefined();
    });

    it('U1, U10: reports a 404 as a vanished issue', async () => {
      client.show.and.rejectWith(new ApiError(404, 'Not found', 'NOT_FOUND'));

      await controller.checkChanged(PROJECT_ID, ISSUE_ID, loadedAt);

      expect(onNotFound).toHaveBeenCalledTimes(1);
    });

    it('U10: ignores any other error', async () => {
      client.show.and.rejectWith(new ApiError(500, 'Boom', 'INTERNAL'));

      await controller.checkChanged(PROJECT_ID, ISSUE_ID, loadedAt);

      expect(onNotFound).not.toHaveBeenCalled();
      expect(state.changedIssue).toBeUndefined();
    });

    it('U10: ignores an empty answer (the session expired)', async () => {
      client.show.and.resolveTo(undefined);

      await controller.checkChanged(PROJECT_ID, ISSUE_ID, loadedAt);

      expect(state.changedIssue).toBeUndefined();
    });
  });

  describe('U10: .reloaded (discard my changes and reload)', () => {
    it('U10: takes the fresh fields and the new updatedAt, so the form is clean', () => {
      const fresh = buildIssue({
        title: 'Fresh', body: null, state: 'closed', updatedAt: '2026-11-07T12:00:00.000Z',
      });
      const reloaded = IssueFormController.reloaded(fresh);

      expect(reloaded).toEqual({
        fields: { title: 'Fresh', body: '', state: 'closed' }, updatedAt: '2026-11-07T12:00:00.000Z',
      });
      expect(IssueFormController.isDirty(reloaded.fields, reloaded.fields)).toBe(false);
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
