import React from 'react';
import IssueLoadViewHelper from '../../../../../../../../assets/js/components/resources/issues/pages/common/IssueLoadViewHelper.jsx';
import LoadErrorHelper from '../../../../../../../../assets/js/components/resources/projects/pages/common/LoadErrorHelper.jsx';
import NotFoundHelper from '../../../../../../../../assets/js/components/resources/projects/pages/common/NotFoundHelper.jsx';
import {
  buildIssue, buildProject, PROJECT_ID,
} from '../../../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('IssueLoadViewHelper', () => {
  const onRetry = jasmine.createSpy('onRetry');
  const renderLoaded = jasmine.createSpy('renderLoaded').and.returnValue(React.createElement('div', null, 'loaded'));
  const stateWith = (loadState, loaded = true) => ({
    projectId: PROJECT_ID,
    project: loaded ? buildProject() : null,
    issue: loaded ? buildIssue() : null,
    loadState: { loading: false, error: null, notFound: null, ...loadState },
  });

  beforeEach(() => {
    spyOn(NotFoundHelper, 'render').and.returnValue(React.createElement('div', null, 'not-found'));
    spyOn(LoadErrorHelper, 'render').and.returnValue(React.createElement('div', null, 'load-error'));
    renderLoaded.calls.reset();
  });

  it('shows "Loading issue…" while loading', () => {
    const output = renderedOutput(IssueLoadViewHelper.render(stateWith({ loading: true }, false), onRetry, renderLoaded));

    expect(output.contains('Loading issue…')).toBe(true);
    expect(renderLoaded).not.toHaveBeenCalled();
  });

  it('shows "Project not found" with a link back to the list', () => {
    IssueLoadViewHelper.render(stateWith({ notFound: 'project' }, false), onRetry, renderLoaded);

    expect(NotFoundHelper.render).toHaveBeenCalledOnceWith(
      'Project not found', { href: '#/projects', text: 'Back to projects' },
    );
  });

  it('shows "Issue not found" with a link back to the project', () => {
    IssueLoadViewHelper.render(stateWith({ notFound: 'issue' }, false), onRetry, renderLoaded);

    expect(NotFoundHelper.render).toHaveBeenCalledOnceWith(
      'Issue not found', { href: `#/projects/${PROJECT_ID}`, text: 'Back to the project' },
    );
  });

  it('shows the load error with Retry', () => {
    IssueLoadViewHelper.render(stateWith({ error: 'Boom' }, false), onRetry, renderLoaded);

    expect(LoadErrorHelper.render).toHaveBeenCalledOnceWith('Boom', onRetry);
  });

  it('renders the loaded content with the project and the issue', () => {
    const state = stateWith({});

    IssueLoadViewHelper.render(state, onRetry, renderLoaded);

    expect(renderLoaded).toHaveBeenCalledOnceWith(state.project, state.issue);
  });
});
