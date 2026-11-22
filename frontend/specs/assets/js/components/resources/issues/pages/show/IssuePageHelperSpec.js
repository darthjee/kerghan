import React from 'react';
import IssueLoadViewHelper from '../../../../../../../../assets/js/components/resources/issues/pages/common/IssueLoadViewHelper.jsx';
import IssuePageHelper from '../../../../../../../../assets/js/components/resources/issues/pages/show/IssuePageHelper.jsx';
import {
  buildIssue, buildLink, buildProject, PROJECT_ID,
} from '../../../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('IssuePageHelper', () => {
  const handlers = {
    onRetry: jasmine.createSpy('onRetry'), onIssueChange: () => undefined, onNotFound: () => undefined,
  };
  const outputOf = (issue) => renderedOutput(IssuePageHelper.render({
    projectId: PROJECT_ID,
    project: buildProject(),
    issue,
    loadState: { loading: false, error: null, notFound: null },
  }, handlers));

  it('shows the header, the body and the actions of the loaded issue', () => {
    const output = outputOf(buildIssue({ title: 'Fix the login' }));

    expect(output.containsInOrder('Back to Kerghan', 'Fix the login', 'Steps to reproduce', 'Edit')).toBe(true);
  });

  it('shows "No description." for an issue without a body', () => {
    expect(outputOf(buildIssue({ body: null })).contains('No description.')).toBe(true);
    expect(outputOf(buildIssue({ body: '' })).contains('No description.')).toBe(true);
  });

  it('shows the body through the plain-text fallback (P5)', () => {
    expect(outputOf(buildIssue({ body: '# Hi' })).containsTag('pre')).toBe(true);
  });

  it('renders nothing in the link-panel slot', () => {
    const plain = outputOf(buildIssue());
    const linked = outputOf(buildIssue({ link: buildLink() }));

    expect(plain.contains('Not linked to GitHub')).toBe(false);
    expect(linked.contains('Synced')).toBe(false);
  });

  it('delegates the load states to IssueLoadViewHelper', () => {
    spyOn(IssueLoadViewHelper, 'render').and.returnValue(React.createElement('div'));
    const state = { projectId: PROJECT_ID, project: null, issue: null, loadState: { loading: true } };

    IssuePageHelper.render(state, handlers);

    expect(IssueLoadViewHelper.render).toHaveBeenCalledOnceWith(state, handlers.onRetry, jasmine.any(Function));
  });
});
