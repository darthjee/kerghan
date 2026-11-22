import React from 'react';
import LoadErrorHelper from '../../../../../../../../assets/js/components/resources/projects/pages/common/LoadErrorHelper.jsx';
import NotFoundHelper from '../../../../../../../../assets/js/components/resources/projects/pages/common/NotFoundHelper.jsx';
import ProjectHeaderHelper from '../../../../../../../../assets/js/components/resources/projects/pages/show/ProjectHeaderHelper.jsx';
import ProjectPageHelper from '../../../../../../../../assets/js/components/resources/projects/pages/show/ProjectPageHelper.jsx';
import { buildProject } from '../../../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('ProjectPageHelper', () => {
  const handlers = { onRetry: jasmine.createSpy('onRetry') };
  const stateWith = (loadState, project = null) => ({
    project, loadState: { loading: false, error: null, notFound: false, ...loadState },
  });

  beforeEach(() => {
    spyOn(NotFoundHelper, 'render').and.returnValue(React.createElement('div', null, 'not-found'));
    spyOn(LoadErrorHelper, 'render').and.returnValue(React.createElement('div', null, 'load-error'));
    spyOn(ProjectHeaderHelper, 'render').and.returnValue(React.createElement('div', null, 'header'));
  });

  it('shows "Loading project…" while loading', () => {
    const output = renderedOutput(ProjectPageHelper.render(stateWith({ loading: true }), handlers));

    expect(output.contains('Loading project…')).toBe(true);
    expect(ProjectHeaderHelper.render).not.toHaveBeenCalled();
  });

  it('shows "Project not found" with a link back to the list', () => {
    renderedOutput(ProjectPageHelper.render(stateWith({ notFound: true }), handlers));

    expect(NotFoundHelper.render).toHaveBeenCalledOnceWith(
      'Project not found', { href: '#/projects', text: 'Back to projects' },
    );
  });

  it('shows the load error with Retry', () => {
    renderedOutput(ProjectPageHelper.render(stateWith({ error: 'Boom' }), handlers));

    expect(LoadErrorHelper.render).toHaveBeenCalledOnceWith('Boom', handlers.onRetry);
  });

  it('shows the header of the loaded project', () => {
    const project = buildProject();
    const output = renderedOutput(ProjectPageHelper.render(stateWith({}, project), handlers));

    expect(output.contains('header')).toBe(true);
    expect(ProjectHeaderHelper.render).toHaveBeenCalledOnceWith(project);
  });

  it('mounts the issue list below the header', () => {
    const output = renderedOutput(ProjectPageHelper.render(stateWith({}, buildProject()), handlers));

    expect(output.containsInOrder('header', 'Loading issues…')).toBe(true);
  });
});
