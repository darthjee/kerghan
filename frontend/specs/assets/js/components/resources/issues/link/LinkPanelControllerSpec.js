import ApiError from '../../../../../../../assets/js/client/ApiError.js';
import LinkPanelController from '../../../../../../../assets/js/components/resources/issues/link/LinkPanelController.js';
import {
  buildIssue, buildLink, ISSUE_ID, PROJECT_ID,
} from '../../../../../../support/issuesBuilders.js';
import { flushMicrotasks } from '../../../../../../support/flushMicrotasks.js';

describe('LinkPanelController', () => {
  let state;
  let client;
  let onNotFound;
  let controller;
  const pendingLink = () => buildLink({ state: 'pending', states: ['pending'] });
  const linked = () => buildIssue({ link: buildLink() });
  const failed = () => buildIssue({ link: buildLink({ state: 'sync_failed', states: ['sync_failed'], reason: 'retries_exhausted' }) });
  const refused = (status, code) => new ApiError(status, 'nope', code);

  beforeEach(() => {
    jasmine.clock().install();
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

  afterEach(() => {
    controller.dispose();
    jasmine.clock().uninstall();
  });

  const lastActivity = () => state.activity[state.activity.length - 1];

  describe('#refresh (T2)', () => {
    it('on a 202 shows the issue and keeps Refreshing until the re-read stops', async () => {
      client.refresh.and.resolveTo({ issue: buildIssue({ link: pendingLink() }), alreadyFresh: false });
      client.show.and.callFake(async () => buildIssue({ link: buildLink() }));

      await controller.refresh(PROJECT_ID, ISSUE_ID);

      expect(state.issue.link.state).toBe('pending');
      expect(lastActivity()).toBe('refresh');

      jasmine.clock().tick(2000);
      await flushMicrotasks();

      expect(client.show).toHaveBeenCalledOnceWith(PROJECT_ID, ISSUE_ID);
      expect(state.issue.link.state).toBe('linked');
      expect(lastActivity()).toBeNull();
    });

    it('on a 200 alreadyFresh shows the issue and "Already up to date", with no re-read', async () => {
      client.refresh.and.resolveTo({ issue: linked(), alreadyFresh: true });

      await controller.refresh(PROJECT_ID, ISSUE_ID);
      jasmine.clock().tick(20000);
      await flushMicrotasks();

      expect(state.notice).toBe('Already up to date');
      expect(client.show).not.toHaveBeenCalled();
      expect(lastActivity()).toBeNull();
    });

    it('U2: ignores a second click while the call is in flight', async () => {
      let answer;

      client.refresh.and.returnValue(new Promise((resolve) => { answer = resolve; }));
      const first = controller.refresh(PROJECT_ID, ISSUE_ID);
      await controller.refresh(PROJECT_ID, ISSUE_ID);

      expect(client.refresh).toHaveBeenCalledTimes(1);
      answer({ issue: linked(), alreadyFresh: true });
      await first;
    });

    it('U2: ignores a second click while the re-read runs, and accepts one after it stopped', async () => {
      client.refresh.and.resolveTo({ issue: buildIssue({ link: pendingLink() }), alreadyFresh: false });
      await controller.refresh(PROJECT_ID, ISSUE_ID);
      await controller.refresh(PROJECT_ID, ISSUE_ID);

      expect(client.refresh).toHaveBeenCalledTimes(1);

      jasmine.clock().tick(2000);
      await flushMicrotasks();
      await controller.refresh(PROJECT_ID, ISSUE_ID);

      expect(client.refresh).toHaveBeenCalledTimes(2);
    });

    ['ISSUE_LINK_GONE', 'ISSUE_NOT_LINKED', 'PROJECT_REPOSITORY_UNAVAILABLE'].forEach((code) => {
      it(`re-reads the issue once and shows the message of ${code}`, async () => {
        client.refresh.and.rejectWith(refused(409, code));

        await controller.refresh(PROJECT_ID, ISSUE_ID);

        expect(client.show).toHaveBeenCalledTimes(1);
        expect(state.issue.title).toBe('reread');
        expect(state.error.message).toBe('nope');
        expect(lastActivity()).toBeNull();
      });
    });

    it('shows a rate limit with its retryAfterSeconds and re-reads nothing', async () => {
      client.refresh.and.rejectWith(new ApiError(429, 'Slow', 'ISSUE_LINK_RATE_LIMITED', undefined, 5, 9));

      await controller.refresh(PROJECT_ID, ISSUE_ID);

      expect(state.error).toEqual({ message: 'Slow', retryAfterSeconds: 9 });
      expect(client.show).not.toHaveBeenCalled();
    });

    it('U1: calls onNotFound for a 404', async () => {
      client.refresh.and.rejectWith(refused(404, undefined));

      await controller.refresh(PROJECT_ID, ISSUE_ID);

      expect(onNotFound).toHaveBeenCalledTimes(1);
      expect(state.error).toBeNull();
    });

    it('changes nothing when the session expired', async () => {
      client.refresh.and.resolveTo(undefined);

      await controller.refresh(PROJECT_ID, ISSUE_ID);

      expect(state.issue).toBeNull();
      expect(lastActivity()).toBeNull();
    });

    it('calls onNotFound when a re-read answers 404', async () => {
      client.refresh.and.resolveTo({ issue: buildIssue({ link: pendingLink() }), alreadyFresh: false });
      client.show.and.rejectWith(refused(404));
      await controller.refresh(PROJECT_ID, ISSUE_ID);

      jasmine.clock().tick(2000);
      await flushMicrotasks();

      expect(onNotFound).toHaveBeenCalledTimes(1);
      expect(lastActivity()).toBeNull();
    });

    it('does not re-read an issue that is gone', async () => {
      client.refresh.and.resolveTo({ issue: buildIssue({ link: buildLink({ state: 'gone', states: ['gone'] }) }), alreadyFresh: false });

      await controller.refresh(PROJECT_ID, ISSUE_ID);

      expect(lastActivity()).toBeNull();
    });
  });

  describe('#retrySync (T4)', () => {
    it('on a 202 (the link was reset) shows the issue and re-reads', async () => {
      client.retrySync.and.resolveTo({ issue: buildIssue({ link: pendingLink() }) });

      await controller.retrySync(PROJECT_ID, ISSUE_ID);

      expect(lastActivity()).toBe('retrySync');
      jasmine.clock().tick(2000);
      await flushMicrotasks();

      expect(client.show).toHaveBeenCalledTimes(1);
    });

    it('on a 200 no-op (still sync_failed) shows the issue with no re-read', async () => {
      client.retrySync.and.resolveTo({ issue: failed() });

      await controller.retrySync(PROJECT_ID, ISSUE_ID);
      jasmine.clock().tick(20000);
      await flushMicrotasks();

      expect(state.issue.link.state).toBe('sync_failed');
      expect(client.show).not.toHaveBeenCalled();
      expect(lastActivity()).toBeNull();
    });

    it('shows a credential refusal', async () => {
      client.retrySync.and.rejectWith(new ApiError(409, 'api', 'GITHUB_CREDENTIAL_UNUSABLE', undefined, undefined, undefined, { reason: 'forbidden' }));

      await controller.retrySync(PROJECT_ID, ISSUE_ID);

      expect(state.error.link.text).toBe('Fix it in Integrations');
    });
  });

  describe('#cancelDiscard', () => {
    it('closes the confirmation', () => {
      controller.cancelDiscard();

      expect(state.confirming).toBeFalse();
    });
  });

  describe('#dispose', () => {
    it('stops the re-read in progress', async () => {
      client.refresh.and.resolveTo({ issue: buildIssue({ link: pendingLink() }), alreadyFresh: false });
      await controller.refresh(PROJECT_ID, ISSUE_ID);

      controller.dispose();
      jasmine.clock().tick(20000);
      await flushMicrotasks();

      expect(client.show).not.toHaveBeenCalled();
    });
  });
});
