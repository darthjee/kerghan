import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProjectLoadController from '../../../../../../../assets/js/components/resources/projects/pages/common/ProjectLoadController.js';
import ProjectLoadViewHelper from '../../../../../../../assets/js/components/resources/projects/pages/common/ProjectLoadViewHelper.jsx';
import IssueNew from '../../../../../../../assets/js/components/resources/issues/pages/IssueNew.jsx';
import IssueFormSection from '../../../../../../../assets/js/components/resources/issues/pages/form/IssueFormSection.jsx';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';
import { buildProject, PROJECT_ID } from '../../../../../../support/issuesBuilders.js';

describe('IssueNew', () => {
  let captured;

  beforeEach(() => {
    installFakeWindow({ location: { hash: `#/projects/${PROJECT_ID}/issues/new` } });
    spyOn(ProjectLoadViewHelper, 'render').and.callFake((state, onRetry, renderLoaded) => {
      captured = { state, onRetry, renderLoaded };
      return React.createElement('div');
    });
    renderToStaticMarkup(React.createElement(IssueNew));
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  it('starts in the loading state with no project', () => {
    expect(captured.state).toEqual({ project: null, loadState: { loading: true, error: null, notFound: false } });
  });

  it('retries through the project load controller', () => {
    spyOn(ProjectLoadController.prototype, 'retry').and.resolveTo();

    captured.onRetry();

    expect(ProjectLoadController.prototype.retry).toHaveBeenCalled();
  });

  it('renders the creation form for the loaded project', () => {
    const project = buildProject();
    const element = captured.renderLoaded(project);

    expect(element.type).toBe(IssueFormSection);
    expect(element.props.project).toBe(project);
    expect(element.props.issue).toBeNull();
    expect(element.props.onNotFound).toEqual(jasmine.any(Function));
  });
});
