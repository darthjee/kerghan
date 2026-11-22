import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import ImportIssueController from '../../../../../../../../assets/js/components/resources/issues/link/modals/ImportIssueController.js';
import {
  buildIssue, buildLink, buildProjectRepository, ISSUE_ID, PROJECT_ID,
} from '../../../../../../../support/issuesBuilders.js';

describe('ImportIssueController', () => {
  let state;
  let client;
  let location;
  let onClose;
  let controller;
  const repository = buildProjectRepository();

  beforeEach(() => {
    state = { pending: [], error: undefined };
    client = jasmine.createSpyObj('client', ['import']);
    client.import.and.resolveTo(buildIssue({ link: buildLink() }));
    location = jasmine.createSpyObj('location', ['push']);
    onClose = jasmine.createSpy('onClose');
    controller = new ImportIssueController({
      setPending: (value) => state.pending.push(value),
      setError: (value) => { state.error = value; },
      onClose,
    }, client, location);
  });

  it('sends only the parsed number, closes the modal and goes to the new issue', async () => {
    await controller.submit(PROJECT_ID, repository, '#12');

    expect(client.import).toHaveBeenCalledOnceWith(PROJECT_ID, { number: 12 });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(location.push).toHaveBeenCalledOnceWith(`#/projects/${PROJECT_ID}/issues/${ISSUE_ID}`);
    expect(state.pending).toEqual([true, false]);
    expect(state.error).toBeNull();
  });

  it('accepts an issue URL of the project repository and sends its number', async () => {
    await controller.submit(PROJECT_ID, repository, 'https://github.com/darthjee/kerghan/issues/7');

    expect(client.import).toHaveBeenCalledOnceWith(PROJECT_ID, { number: 7 });
  });

  it('rejects a URL of another repository without a call', async () => {
    await controller.submit(PROJECT_ID, repository, 'https://github.com/other/repo/issues/7');

    expect(client.import).not.toHaveBeenCalled();
    expect(state.error).toEqual({ message: 'This issue is not in darthjee/kerghan' });
  });

  ['abc', '', '0'].forEach((raw) => {
    it(`rejects "${raw}" without a call`, async () => {
      await controller.submit(PROJECT_ID, repository, raw);

      expect(client.import).not.toHaveBeenCalled();
      expect(state.error).toEqual({ message: 'Enter an issue number or GitHub issue URL' });
      expect(state.pending).toEqual([]);
    });
  });

  it('shows GITHUB_ISSUE_ALREADY_LINKED (E4) with a link to the existing issue, and stays open', async () => {
    client.import.and.rejectWith(new ApiError(409, 'api', 'GITHUB_ISSUE_ALREADY_LINKED', undefined, undefined, undefined, {
      projectId: PROJECT_ID, issueId: ISSUE_ID,
    }));

    await controller.submit(PROJECT_ID, repository, '12');

    expect(state.error.message).toBe('This GitHub issue is already linked');
    expect(state.error.link.href).toBe(`#/projects/${PROJECT_ID}/issues/${ISSUE_ID}`);
    expect(onClose).not.toHaveBeenCalled();
    expect(location.push).not.toHaveBeenCalled();
    expect(state.pending).toEqual([true, false]);
  });

  [
    ['GITHUB_CREDENTIAL_UNUSABLE', 409], ['GITHUB_ISSUE_NOT_FOUND', 404], ['ISSUES_LIMIT_REACHED', 409],
    ['PROJECT_REPOSITORY_CHANGED', 409], ['GITHUB_UNAVAILABLE', 502],
  ].forEach(([code, status]) => {
    it(`shows ${code} through the error map`, async () => {
      client.import.and.rejectWith(new ApiError(status, 'api message', code));

      await controller.submit(PROJECT_ID, repository, '12');

      expect(state.error.message).toEqual(jasmine.any(String));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  ['ISSUE_LINK_RATE_LIMITED', 'GITHUB_RATE_LIMITED'].forEach((code) => {
    it(`passes the retryAfterSeconds of ${code} on`, async () => {
      client.import.and.rejectWith(new ApiError(429, 'Slow', code, undefined, 5, 8));

      await controller.submit(PROJECT_ID, repository, '12');

      expect(state.error).toEqual({ message: 'Slow', retryAfterSeconds: 8 });
    });
  });

  it('U2: ignores a second submit while one is in flight', async () => {
    let answer;

    client.import.and.returnValue(new Promise((resolve) => { answer = resolve; }));
    const first = controller.submit(PROJECT_ID, repository, '12');
    await controller.submit(PROJECT_ID, repository, '13');

    expect(client.import).toHaveBeenCalledTimes(1);
    answer(buildIssue());
    await first;
  });

  it('changes nothing when the session expired', async () => {
    client.import.and.resolveTo(undefined);

    await controller.submit(PROJECT_ID, repository, '12');

    expect(onClose).not.toHaveBeenCalled();
    expect(location.push).not.toHaveBeenCalled();
  });

  it('uses the real hash writer by default', () => {
    expect(() => new ImportIssueController({ setPending: () => undefined, setError: () => undefined, onClose })).not.toThrow();
  });
});
