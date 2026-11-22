import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import IssueActions from '../../../../../../../../assets/js/components/resources/issues/pages/show/IssueActions.jsx';
import IssueActionsHelper from '../../../../../../../../assets/js/components/resources/issues/pages/show/IssueActionsHelper.jsx';
import IssueActionsController from '../../../../../../../../assets/js/components/resources/issues/pages/show/IssueActionsController.js';
import { buildIssue, PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';

describe('IssueActions', () => {
  let captured;
  const issue = buildIssue();

  beforeEach(() => {
    spyOn(IssueActionsHelper, 'render').and.callFake((state, handlers) => {
      captured = { state, handlers };
      return React.createElement('div');
    });
    renderToStaticMarkup(React.createElement(IssueActions, {
      projectId: PROJECT_ID, issue, onIssueChange: () => undefined, onNotFound: () => undefined,
    }));
  });

  it('starts idle: not busy, no error, no confirmation, no countdown', () => {
    expect(captured.state).toEqual({
      projectId: PROJECT_ID,
      issue,
      busy: false,
      error: null,
      confirming: false,
      countdown: { active: false, secondsLeft: 0, label: null },
    });
  });

  it('toggles and deletes through the controller', () => {
    spyOn(IssueActionsController.prototype, 'toggleState').and.resolveTo();
    spyOn(IssueActionsController.prototype, 'remove').and.resolveTo();

    captured.handlers.onToggle();
    captured.handlers.onDelete();

    expect(IssueActionsController.prototype.toggleState).toHaveBeenCalledOnceWith(PROJECT_ID, issue);
    expect(IssueActionsController.prototype.remove).toHaveBeenCalledOnceWith(PROJECT_ID, issue.id);
  });
});
