import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LinkPanel from '../../../../../../../assets/js/components/resources/issues/link/LinkPanel.jsx';
import LinkPanelController from '../../../../../../../assets/js/components/resources/issues/link/LinkPanelController.js';
import LinkPanelHelper from '../../../../../../../assets/js/components/resources/issues/link/LinkPanelHelper.jsx';
import {
  buildIssue, buildLink, buildProject, ISSUE_ID, PROJECT_ID,
} from '../../../../../../support/issuesBuilders.js';

describe('LinkPanel', () => {
  let captured;
  const issue = buildIssue({ link: buildLink() });
  const project = buildProject();

  beforeEach(() => {
    spyOn(LinkPanelHelper, 'render').and.callFake((state, handlers) => {
      captured = { state, handlers };
      return React.createElement('div');
    });
    renderToStaticMarkup(React.createElement(LinkPanel, {
      projectId: PROJECT_ID, project, issue, onIssueChange: () => undefined, onNotFound: () => undefined,
    }));
  });

  it('starts idle with the presenter view of the link', () => {
    expect(captured.state.view.linked).toBeTrue();
    expect(captured.state.view.number).toBe(12);
    expect(captured.state.activity).toBeNull();
    expect(captured.state.notice).toBeNull();
    expect(captured.state.error).toBeNull();
    expect(captured.state.confirming).toBeFalse();
    expect(captured.state.countdown.active).toBeFalse();
  });

  it('runs the actions through the controller', () => {
    spyOn(LinkPanelController.prototype, 'refresh').and.resolveTo();
    spyOn(LinkPanelController.prototype, 'retrySync').and.resolveTo();
    spyOn(LinkPanelController.prototype, 'unlink').and.resolveTo();
    spyOn(LinkPanelController.prototype, 'confirmDiscard').and.resolveTo();
    spyOn(LinkPanelController.prototype, 'cancelDiscard');

    captured.handlers.onRefresh();
    captured.handlers.onRetrySync();
    captured.handlers.onUnlink();
    captured.handlers.onConfirmDiscard();
    captured.handlers.onCancelDiscard();

    expect(LinkPanelController.prototype.refresh).toHaveBeenCalledOnceWith(PROJECT_ID, ISSUE_ID);
    expect(LinkPanelController.prototype.retrySync).toHaveBeenCalledOnceWith(PROJECT_ID, ISSUE_ID);
    expect(LinkPanelController.prototype.unlink).toHaveBeenCalledOnceWith(PROJECT_ID, issue);
    expect(LinkPanelController.prototype.confirmDiscard).toHaveBeenCalledOnceWith(PROJECT_ID, issue);
    expect(LinkPanelController.prototype.cancelDiscard).toHaveBeenCalled();
  });

  it('offers attach and close handlers', () => {
    expect(captured.handlers.onAttach).toEqual(jasmine.any(Function));
    expect(captured.handlers.onCloseAttach).toEqual(jasmine.any(Function));
    expect(captured.state.attaching).toBeFalse();
  });
});
