import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import IssueLoadController from '../../../../../../../assets/js/components/resources/issues/pages/common/IssueLoadController.js';
import IssuePage from '../../../../../../../assets/js/components/resources/issues/pages/IssuePage.jsx';
import IssuePageHelper from '../../../../../../../assets/js/components/resources/issues/pages/show/IssuePageHelper.jsx';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';
import { ISSUE_ID, PROJECT_ID } from '../../../../../../support/issuesBuilders.js';

describe('IssuePage', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  const render = (hash) => {
    let captured;

    installFakeWindow({ location: { hash } });
    spyOn(IssuePageHelper, 'render').and.callFake((state, handlers) => {
      captured = { state, handlers };
      return React.createElement('div');
    });
    renderToStaticMarkup(React.createElement(IssuePage));
    return captured;
  };

  it('extracts both ids and starts in the loading state with nothing loaded', () => {
    const { state } = render(`#/projects/${PROJECT_ID}/issues/${ISSUE_ID}`);

    expect(state).toEqual({
      projectId: PROJECT_ID,
      project: null,
      issue: null,
      loadState: { loading: true, error: null, notFound: null },
    });
  });

  it('retries through the controller', () => {
    spyOn(IssueLoadController.prototype, 'retry').and.resolveTo();
    const { handlers } = render(`#/projects/${PROJECT_ID}/issues/${ISSUE_ID}`);

    handlers.onRetry();

    expect(IssueLoadController.prototype.retry).toHaveBeenCalled();
  });

  it('hands over the quiet focus re-read of the load controller', () => {
    spyOn(IssueLoadController.prototype, 'reread').and.resolveTo();
    const { state } = render(`#/projects/${PROJECT_ID}/issues/${ISSUE_ID}`);

    expect(state.loadState.loading).toBeTrue();
    expect(IssueLoadController.prototype.reread).not.toHaveBeenCalled();
  });

  it('hands over the issue setter and the not-found callback', () => {
    const { handlers } = render(`#/projects/${PROJECT_ID}/issues/${ISSUE_ID}`);

    expect(handlers.onIssueChange).toEqual(jasmine.any(Function));
    expect(handlers.onNotFound).toEqual(jasmine.any(Function));
  });
});
