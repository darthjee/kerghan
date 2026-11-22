import React from 'react';
import IssueBody from '../../../../../../../../assets/js/components/resources/issues/body/IssueBody.jsx';
import IssueLoadViewHelper from '../../../../../../../../assets/js/components/resources/issues/pages/common/IssueLoadViewHelper.jsx';
import IssuePageHelper from '../../../../../../../../assets/js/components/resources/issues/pages/show/IssuePageHelper.jsx';
import {
  buildIssue, buildLink, buildProject, PROJECT_ID,
} from '../../../../../../../support/issuesBuilders.js';
import { findElements } from '../../../../../../../support/elementTree.js';
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

  it('hands the body to IssueBody, which owns the plain-text fallback (P5)', () => {
    const tree = IssuePageHelper.render({
      projectId: PROJECT_ID,
      project: buildProject(),
      issue: buildIssue({ body: '# Hi' }),
      loadState: { loading: false, error: null, notFound: null },
    }, handlers);
    const [body] = findElements(tree, (node) => node.type === IssueBody);

    expect(body.props.body).toBe('# Hi');
  });

  it('shows the link panel between the header and the body', () => {
    expect(outputOf(buildIssue()).containsInOrder('Fix the login', 'Not linked to GitHub', 'Steps to reproduce')).toBe(true);
    expect(outputOf(buildIssue({ link: buildLink() })).containsInOrder('Synced', 'Steps to reproduce')).toBe(true);
  });

  it('delegates the load states to IssueLoadViewHelper', () => {
    spyOn(IssueLoadViewHelper, 'render').and.returnValue(React.createElement('div'));
    const state = { projectId: PROJECT_ID, project: null, issue: null, loadState: { loading: true } };

    IssuePageHelper.render(state, handlers);

    expect(IssueLoadViewHelper.render).toHaveBeenCalledOnceWith(state, handlers.onRetry, jasmine.any(Function));
  });
});
