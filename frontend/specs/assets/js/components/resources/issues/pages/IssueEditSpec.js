import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import IssueLoadController from '../../../../../../../assets/js/components/resources/issues/pages/common/IssueLoadController.js';
import IssueLoadViewHelper from '../../../../../../../assets/js/components/resources/issues/pages/common/IssueLoadViewHelper.jsx';
import IssueEdit from '../../../../../../../assets/js/components/resources/issues/pages/IssueEdit.jsx';
import IssueFormSection from '../../../../../../../assets/js/components/resources/issues/pages/form/IssueFormSection.jsx';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';
import {
  buildIssue, buildProject, ISSUE_ID, PROJECT_ID,
} from '../../../../../../support/issuesBuilders.js';

describe('IssueEdit', () => {
  let captured;

  beforeEach(() => {
    installFakeWindow({ location: { hash: `#/projects/${PROJECT_ID}/issues/${ISSUE_ID}/edit` } });
    spyOn(IssueLoadViewHelper, 'render').and.callFake((state, onRetry, renderLoaded) => {
      captured = { state, onRetry, renderLoaded };
      return React.createElement('div');
    });
    renderToStaticMarkup(React.createElement(IssueEdit));
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  it('extracts both ids and starts in the loading state with nothing loaded', () => {
    expect(captured.state).toEqual({
      projectId: PROJECT_ID,
      project: null,
      issue: null,
      loadState: { loading: true, error: null, notFound: null },
    });
  });

  it('retries through the issue load controller', () => {
    spyOn(IssueLoadController.prototype, 'retry').and.resolveTo();

    captured.onRetry();

    expect(IssueLoadController.prototype.retry).toHaveBeenCalled();
  });

  it('renders the edit form for the loaded project and issue', () => {
    const project = buildProject();
    const issue = buildIssue();
    const element = captured.renderLoaded(project, issue);

    expect(element.type).toBe(IssueFormSection);
    expect(element.props.project).toBe(project);
    expect(element.props.issue).toBe(issue);
  });
});
