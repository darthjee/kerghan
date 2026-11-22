import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import IssueActionsController from '../../../../../../../../assets/js/components/resources/issues/pages/show/IssueActionsController.js';
import {
  buildIssue, buildLink, ISSUE_ID, PROJECT_ID,
} from '../../../../../../../support/issuesBuilders.js';

describe('IssueActionsController', () => {
  let state;
  let client;
  let location;
  let onNotFound;
  let controller;

  beforeEach(() => {
    state = { issue: null, busy: [], error: undefined };
    client = jasmine.createSpyObj('client', ['edit', 'delete']);
    client.edit.and.callFake((projectId, issueId, fields) => Promise.resolve(buildIssue({ state: fields.state })));
    client.delete.and.resolveTo({});
    location = jasmine.createSpyObj('location', ['push']);
    onNotFound = jasmine.createSpy('onNotFound');
    controller = new IssueActionsController({
      setIssue: (value) => { state.issue = value; },
      setBusy: (value) => state.busy.push(value),
      setError: (value) => { state.error = value; },
      onNotFound,
    }, client, location);
  });

  describe('#toggleState', () => {
    it('closes an open issue, sending only state, and shows the returned issue', async () => {
      await controller.toggleState(PROJECT_ID, buildIssue({ state: 'open' }));

      expect(client.edit).toHaveBeenCalledOnceWith(PROJECT_ID, ISSUE_ID, { state: 'closed' });
      expect(state.issue.state).toBe('closed');
    });

    it('reopens a closed issue, sending only state', async () => {
      await controller.toggleState(PROJECT_ID, buildIssue({ state: 'closed' }));

      expect(client.edit).toHaveBeenCalledOnceWith(PROJECT_ID, ISSUE_ID, { state: 'open' });
      expect(state.issue.state).toBe('open');
    });

    it('U2: is in flight while the call runs, and ignores a second click', async () => {
      let answer;

      client.edit.and.returnValue(new Promise((resolve) => { answer = resolve; }));
      const first = controller.toggleState(PROJECT_ID, buildIssue());
      await controller.toggleState(PROJECT_ID, buildIssue());

      expect(client.edit).toHaveBeenCalledTimes(1);
      expect(state.busy).toEqual([true]);

      answer(buildIssue({ state: 'closed' }));
      await first;
      expect(state.busy).toEqual([true, false]);
    });

    it('clears the previous error when it starts', async () => {
      state.error = { message: 'old' };

      await controller.toggleState(PROJECT_ID, buildIssue());

      expect(state.error).toBeNull();
    });

    it('shows ISSUE_EDIT_RATE_LIMITED with its retryAfterSeconds', async () => {
      client.edit.and.rejectWith(new ApiError(429, 'Slow down', 'ISSUE_EDIT_RATE_LIMITED', undefined, undefined, 12));

      await controller.toggleState(PROJECT_ID, buildIssue());

      expect(state.error).toEqual({ message: 'Slow down', retryAfterSeconds: 12 });
      expect(state.busy).toEqual([true, false]);
    });

    it('shows any other failure inline', async () => {
      client.edit.and.rejectWith(new ApiError(500, 'Boom', 'INTERNAL'));

      await controller.toggleState(PROJECT_ID, buildIssue());

      expect(state.error).toEqual({ message: 'Boom' });
    });

    it('reports a 404 as a vanished issue', async () => {
      client.edit.and.rejectWith(new ApiError(404, 'Not found', 'NOT_FOUND'));

      await controller.toggleState(PROJECT_ID, buildIssue());

      expect(onNotFound).toHaveBeenCalledTimes(1);
      expect(state.error).toBeNull();
    });

    it('changes nothing when the session expired (undefined answer)', async () => {
      client.edit.and.resolveTo(undefined);

      await controller.toggleState(PROJECT_ID, buildIssue());

      expect(state.issue).toBeNull();
      expect(state.busy).toEqual([true, false]);
    });
  });

  describe('#remove', () => {
    it('deletes the issue and goes to the project page', async () => {
      await controller.remove(PROJECT_ID, ISSUE_ID);

      expect(client.delete).toHaveBeenCalledOnceWith(PROJECT_ID, ISSUE_ID);
      expect(location.push).toHaveBeenCalledOnceWith(`#/projects/${PROJECT_ID}`);
    });

    it('counts a 404 as done', async () => {
      client.delete.and.rejectWith(new ApiError(404, 'Not found', 'NOT_FOUND'));

      await controller.remove(PROJECT_ID, ISSUE_ID);

      expect(location.push).toHaveBeenCalledOnceWith(`#/projects/${PROJECT_ID}`);
    });

    it('rejects with "Unlink this issue before deleting it" for ISSUE_LINKED (a race)', async () => {
      client.delete.and.rejectWith(new ApiError(409, 'Issue is linked', 'ISSUE_LINKED'));

      await expectAsync(controller.remove(PROJECT_ID, ISSUE_ID))
        .toBeRejectedWithError('Unlink this issue before deleting it');
      expect(location.push).not.toHaveBeenCalled();
    });

    it('rejects with the message of any other failure', async () => {
      client.delete.and.rejectWith(new ApiError(500, 'Boom', 'INTERNAL'));

      await expectAsync(controller.remove(PROJECT_ID, ISSUE_ID)).toBeRejectedWithError('Boom');
    });

    it('stays put when the session expired (undefined answer)', async () => {
      client.delete.and.resolveTo(undefined);

      await controller.remove(PROJECT_ID, ISSUE_ID);

      expect(location.push).not.toHaveBeenCalled();
    });
  });

  it('is built over the shared issue builders (a linked issue stays linked until unlinked)', () => {
    expect(buildIssue({ link: buildLink() }).link).not.toBeNull();
  });
});
