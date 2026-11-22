import React from 'react';
import LoadErrorHelper from '../../../../../../../../assets/js/components/resources/projects/pages/common/LoadErrorHelper.jsx';
import NotFoundHelper from '../../../../../../../../assets/js/components/resources/projects/pages/common/NotFoundHelper.jsx';
import ProjectLoadViewHelper from '../../../../../../../../assets/js/components/resources/projects/pages/common/ProjectLoadViewHelper.jsx';
import { buildProject } from '../../../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('ProjectLoadViewHelper', () => {
  const onRetry = () => undefined;
  const stateWith = (loadState, project = null) => ({
    project, loadState: { loading: false, error: null, notFound: false, ...loadState },
  });
  let renderLoaded;

  beforeEach(() => {
    renderLoaded = jasmine.createSpy('renderLoaded').and.returnValue(React.createElement('div', null, 'loaded'));
    spyOn(NotFoundHelper, 'render').and.returnValue(React.createElement('div', null, 'not-found'));
    spyOn(LoadErrorHelper, 'render').and.returnValue(React.createElement('div', null, 'load-error'));
  });

  it('shows the not-found view first, linking back to the list', () => {
    ProjectLoadViewHelper.render(stateWith({ notFound: true, error: 'x', loading: true }), onRetry, renderLoaded);

    expect(NotFoundHelper.render).toHaveBeenCalledWith('Project not found', { href: '#/projects', text: 'Back to projects' });
    expect(renderLoaded).not.toHaveBeenCalled();
  });

  it('shows the load error with Retry', () => {
    ProjectLoadViewHelper.render(stateWith({ error: 'Boom' }), onRetry, renderLoaded);

    expect(LoadErrorHelper.render).toHaveBeenCalledWith('Boom', onRetry);
  });

  it('shows "Loading project…" while loading, or before the project arrived', () => {
    const loading = renderedOutput(ProjectLoadViewHelper.render(stateWith({ loading: true }), onRetry, renderLoaded));
    const waiting = renderedOutput(ProjectLoadViewHelper.render(stateWith({}), onRetry, renderLoaded));

    expect(loading.contains('Loading project…')).toBe(true);
    expect(waiting.contains('Loading project…')).toBe(true);
    expect(renderLoaded).not.toHaveBeenCalled();
  });

  it('renders the loaded content with the project', () => {
    const project = buildProject();
    const output = renderedOutput(ProjectLoadViewHelper.render(stateWith({}, project), onRetry, renderLoaded));

    expect(output.contains('loaded')).toBe(true);
    expect(renderLoaded).toHaveBeenCalledWith(project);
  });
});
