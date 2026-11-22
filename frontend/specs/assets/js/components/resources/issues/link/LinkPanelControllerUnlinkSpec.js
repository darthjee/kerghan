import ApiError from '../../../../../../../assets/js/client/ApiError.js';
import LinkPanelController from '../../../../../../../assets/js/components/resources/issues/link/LinkPanelController.js';
import {
  buildIssue, buildLink, ISSUE_ID, PROJECT_ID,
} from '../../../../../../support/issuesBuilders.js';

describe('LinkPanelController (unlink)', () => {
  let state;
  let client;
  let onNotFound;
  let controller;
  const linked = () => buildIssue({ link: buildLink() });
  const refused = (status, code) => new ApiError(status, 'nope', code);

  beforeEach(() => {
    state = {
      issue: null, activity: [], notice: undefined, error: undefined, confirming: undefined,
    };
    client = jasmine.createSpyObj('client', ['refresh', 'retrySync', 'unlink', 'show']);
    client.show.and.callFake(async () => buildIssue({ title: 'reread' }));
    onNotFound = jasmine.createSpy('onNotFound');
    controller = new LinkPanelController({
      setIssue: (value) => { state.issue = value; },
      setActivity: (value) => state.activity.push(value),
      setNotice: (value) => { state.notice = value; },
      setError: (value) => { state.error = value; },
      setConfirming: (value) => { state.confirming = value; },
      onNotFound,
    }, client);
  });

  const lastActivity = () => state.activity[state.activity.length - 1];

  describe('#unlink', () => {
    it('unlinks with no confirmation and shows the issue as unlinked', async () => {
      client.unlink.and.resolveTo({ issue: buildIssue({ link: null }), droppedUnsentChanges: false });

      await controller.unlink(PROJECT_ID, linked());

      expect(client.unlink).toHaveBeenCalledOnceWith(PROJECT_ID, ISSUE_ID, {});
      expect(state.issue.link).toBeNull();
      expect(lastActivity()).toBeNull();
    });

    it('E63: opens the discard confirmation on ISSUE_UNLINK_HAS_UNSENT_CHANGES', async () => {
      client.unlink.and.rejectWith(refused(409, 'ISSUE_UNLINK_HAS_UNSENT_CHANGES'));

      await controller.unlink(PROJECT_ID, linked());

      expect(state.confirming).toBeTrue();
      expect(state.error).toBeNull();
    });

    it('E64, U3: re-reads and shows the issue unlinked on ISSUE_NOT_LINKED', async () => {
      client.unlink.and.rejectWith(refused(409, 'ISSUE_NOT_LINKED'));
      client.show.and.resolveTo(buildIssue({ link: null }));

      await controller.unlink(PROJECT_ID, linked());

      expect(state.issue.link).toBeNull();
      expect(state.error).toBeNull();
    });

    it('E64: shows the issue unlinked even when the re-read fails', async () => {
      client.unlink.and.rejectWith(refused(409, 'ISSUE_NOT_LINKED'));
      client.show.and.rejectWith(new Error('network'));

      await controller.unlink(PROJECT_ID, linked());

      expect(state.issue.link).toBeNull();
      expect(onNotFound).not.toHaveBeenCalled();
    });

    it('calls onNotFound for a 404', async () => {
      client.unlink.and.rejectWith(refused(404));

      await controller.unlink(PROJECT_ID, linked());

      expect(onNotFound).toHaveBeenCalledTimes(1);
    });

    it('shows any other error', async () => {
      client.unlink.and.rejectWith(refused(500, 'BOOM'));

      await controller.unlink(PROJECT_ID, linked());

      expect(state.error.message).toBe('nope');
    });

    it('U2: ignores a second click while in flight', async () => {
      let answer;

      client.unlink.and.returnValue(new Promise((resolve) => { answer = resolve; }));
      const first = controller.unlink(PROJECT_ID, linked());
      await controller.unlink(PROJECT_ID, linked());

      expect(client.unlink).toHaveBeenCalledTimes(1);
      expect(lastActivity()).toBe('unlink');
      answer({ issue: buildIssue(), droppedUnsentChanges: false });
      await first;
    });

    it('changes nothing when the session expired', async () => {
      client.unlink.and.resolveTo(undefined);

      await controller.unlink(PROJECT_ID, linked());

      expect(state.issue).toBeNull();
    });
  });

  describe('#confirmDiscard (E63)', () => {
    it('unlinks with discard: true and closes the confirmation', async () => {
      client.unlink.and.resolveTo({ issue: buildIssue({ link: null }), droppedUnsentChanges: true });

      await controller.confirmDiscard(PROJECT_ID, linked());

      expect(client.unlink).toHaveBeenCalledOnceWith(PROJECT_ID, ISSUE_ID, { discard: true });
      expect(state.confirming).toBeFalse();
      expect(state.issue.link).toBeNull();
    });

    it('E64: treats ISSUE_NOT_LINKED as done and closes the confirmation', async () => {
      client.unlink.and.rejectWith(refused(409, 'ISSUE_NOT_LINKED'));
      client.show.and.resolveTo(buildIssue({ link: null }));

      await controller.confirmDiscard(PROJECT_ID, linked());

      expect(state.issue.link).toBeNull();
      expect(state.confirming).toBeFalse();
    });

    it('calls onNotFound for a 404 and closes the confirmation', async () => {
      client.unlink.and.rejectWith(refused(404));

      await controller.confirmDiscard(PROJECT_ID, linked());

      expect(onNotFound).toHaveBeenCalledTimes(1);
      expect(state.confirming).toBeFalse();
    });

    it('rejects with the message to show inside the modal for another error', async () => {
      client.unlink.and.rejectWith(refused(500, 'BOOM'));

      await expectAsync(controller.confirmDiscard(PROJECT_ID, linked())).toBeRejectedWithError('nope');
      expect(lastActivity()).toBeNull();
    });

    it('U2: ignores a second call while in flight', async () => {
      let answer;

      client.unlink.and.returnValue(new Promise((resolve) => { answer = resolve; }));
      const first = controller.confirmDiscard(PROJECT_ID, linked());
      await controller.confirmDiscard(PROJECT_ID, linked());

      expect(client.unlink).toHaveBeenCalledTimes(1);
      answer(undefined);
      await first;
    });
  });
});
