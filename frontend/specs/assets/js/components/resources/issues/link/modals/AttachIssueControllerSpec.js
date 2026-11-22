import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import AttachIssueController from '../../../../../../../../assets/js/components/resources/issues/link/modals/AttachIssueController.js';
import {
  buildIssue, buildLink, buildProjectRepository, ISSUE_ID, PROJECT_ID,
} from '../../../../../../../support/issuesBuilders.js';

describe('AttachIssueController', () => {
  let state;
  let client;
  let handlers;
  let controller;
  const repository = buildProjectRepository();
  const confirmation = (differences, updatedAt) => new ApiError(
    409, 'api', 'ISSUE_ATTACH_CONFIRMATION_REQUIRED', undefined, undefined, undefined, { differences, updatedAt },
  );

  beforeEach(() => {
    state = { pending: [], error: undefined, warning: undefined };
    client = jasmine.createSpyObj('client', ['attach']);
    client.attach.and.resolveTo(buildIssue({ link: buildLink() }));
    handlers = {
      setPending: (value) => state.pending.push(value),
      setError: (value) => { state.error = value; },
      setWarning: (value) => { state.warning = value; },
      onAttached: jasmine.createSpy('onAttached'),
      onClose: jasmine.createSpy('onClose'),
      onAlreadyLinked: jasmine.createSpy('onAlreadyLinked'),
      onNotFound: jasmine.createSpy('onNotFound'),
    };
    controller = new AttachIssueController(handlers, client);
  });

  describe('#submit', () => {
    it('attaches directly, with no confirmUpdatedAt, then closes and shows the issue', async () => {
      await controller.submit(PROJECT_ID, ISSUE_ID, repository, '12');

      expect(client.attach).toHaveBeenCalledOnceWith(PROJECT_ID, ISSUE_ID, { number: 12 });
      expect(handlers.onAttached).toHaveBeenCalledOnceWith(jasmine.objectContaining({ link: jasmine.any(Object) }));
      expect(handlers.onClose).toHaveBeenCalledTimes(1);
      expect(state.pending).toEqual([true, false]);
    });

    it('rejects an unparseable input without a call', async () => {
      await controller.submit(PROJECT_ID, ISSUE_ID, repository, 'nope');

      expect(client.attach).not.toHaveBeenCalled();
      expect(state.error).toEqual({ message: 'Enter an issue number or GitHub issue URL' });
    });

    it('rejects a URL of another repository without a call', async () => {
      await controller.submit(PROJECT_ID, ISSUE_ID, repository, 'https://github.com/o/r/issues/1');

      expect(client.attach).not.toHaveBeenCalled();
      expect(state.error.message).toBe('This issue is not in darthjee/kerghan');
    });

    it('E61: switches to the warning on ISSUE_ATTACH_CONFIRMATION_REQUIRED, keeping the modal open', async () => {
      client.attach.and.rejectWith(confirmation(['title', 'body'], '2026-11-07T11:00:00.000Z'));

      await controller.submit(PROJECT_ID, ISSUE_ID, repository, '#12');

      expect(state.warning).toEqual({ number: 12, differences: ['title', 'body'], updatedAt: '2026-11-07T11:00:00.000Z' });
      expect(state.error).toBeNull();
      expect(handlers.onClose).not.toHaveBeenCalled();
      expect(handlers.onAttached).not.toHaveBeenCalled();
    });

    it('U3: closes and re-reads the issue on ISSUE_ALREADY_LINKED', async () => {
      client.attach.and.rejectWith(new ApiError(409, 'api', 'ISSUE_ALREADY_LINKED'));

      await controller.submit(PROJECT_ID, ISSUE_ID, repository, '12');

      expect(handlers.onClose).toHaveBeenCalledTimes(1);
      expect(handlers.onAlreadyLinked).toHaveBeenCalledTimes(1);
    });

    it('behaves as import on GITHUB_ISSUE_ALREADY_LINKED: message with its link, stays open', async () => {
      client.attach.and.rejectWith(new ApiError(409, 'api', 'GITHUB_ISSUE_ALREADY_LINKED', undefined, undefined, undefined, {
        projectId: PROJECT_ID, issueId: ISSUE_ID,
      }));

      await controller.submit(PROJECT_ID, ISSUE_ID, repository, '12');

      expect(state.error.link.href).toBe(`#/projects/${PROJECT_ID}/issues/${ISSUE_ID}`);
      expect(handlers.onClose).not.toHaveBeenCalled();
    });

    it('closes and reports a vanished issue (404)', async () => {
      client.attach.and.rejectWith(new ApiError(404, 'gone'));

      await controller.submit(PROJECT_ID, ISSUE_ID, repository, '12');

      expect(handlers.onNotFound).toHaveBeenCalledTimes(1);
      expect(handlers.onClose).toHaveBeenCalledTimes(1);
    });

    it('passes a rate limit with its countdown seconds', async () => {
      client.attach.and.rejectWith(new ApiError(429, 'Slow', 'ISSUE_LINK_RATE_LIMITED', undefined, 5, 8));

      await controller.submit(PROJECT_ID, ISSUE_ID, repository, '12');

      expect(state.error).toEqual({ message: 'Slow', retryAfterSeconds: 8 });
    });

    it('U2: ignores a second submit while in flight', async () => {
      let answer;

      client.attach.and.returnValue(new Promise((resolve) => { answer = resolve; }));
      const first = controller.submit(PROJECT_ID, ISSUE_ID, repository, '12');
      await controller.submit(PROJECT_ID, ISSUE_ID, repository, '13');

      expect(client.attach).toHaveBeenCalledTimes(1);
      answer(buildIssue());
      await first;
    });

    it('changes nothing when the session expired', async () => {
      client.attach.and.resolveTo(undefined);

      await controller.submit(PROJECT_ID, ISSUE_ID, repository, '12');

      expect(handlers.onClose).not.toHaveBeenCalled();
    });
  });

  describe('#confirm', () => {
    const warning = { number: 12, differences: ['title'], updatedAt: '2026-11-07T11:00:00.000Z' };

    it('retries with confirmUpdatedAt from the warning, then closes', async () => {
      await controller.confirm(PROJECT_ID, ISSUE_ID, warning);

      expect(client.attach).toHaveBeenCalledOnceWith(PROJECT_ID, ISSUE_ID, {
        number: 12, confirmUpdatedAt: '2026-11-07T11:00:00.000Z',
      });
      expect(handlers.onAttached).toHaveBeenCalledTimes(1);
      expect(handlers.onClose).toHaveBeenCalledTimes(1);
    });

    it('E61: shows the warning again with the new differences on a second 409', async () => {
      client.attach.and.rejectWith(confirmation(['state'], '2026-11-07T12:00:00.000Z'));

      await controller.confirm(PROJECT_ID, ISSUE_ID, warning);

      expect(state.warning).toEqual({ number: 12, differences: ['state'], updatedAt: '2026-11-07T12:00:00.000Z' });
      expect(handlers.onClose).not.toHaveBeenCalled();
    });

    it('U3: closes and re-reads on ISSUE_ALREADY_LINKED', async () => {
      client.attach.and.rejectWith(new ApiError(409, 'api', 'ISSUE_ALREADY_LINKED'));

      await controller.confirm(PROJECT_ID, ISSUE_ID, warning);

      expect(handlers.onAlreadyLinked).toHaveBeenCalledTimes(1);
      expect(handlers.onClose).toHaveBeenCalledTimes(1);
    });

    it('rejects with the message to show inside the confirmation for another error', async () => {
      client.attach.and.rejectWith(new ApiError(502, 'api', 'GITHUB_UNAVAILABLE'));

      await expectAsync(controller.confirm(PROJECT_ID, ISSUE_ID, warning))
        .toBeRejectedWithError('GitHub is unavailable right now; try again.');
    });

    it('U2: ignores a second confirm while in flight', async () => {
      let answer;

      client.attach.and.returnValue(new Promise((resolve) => { answer = resolve; }));
      const first = controller.confirm(PROJECT_ID, ISSUE_ID, warning);
      await controller.confirm(PROJECT_ID, ISSUE_ID, warning);

      expect(client.attach).toHaveBeenCalledTimes(1);
      answer(buildIssue());
      await first;
    });
  });
});
