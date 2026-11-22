import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProjectDetailsHelper from '../../../../../../../../assets/js/components/resources/projects/pages/edit/ProjectDetailsHelper.jsx';
import ProjectDetailsSection from '../../../../../../../../assets/js/components/resources/projects/pages/edit/ProjectDetailsSection.jsx';
import { buildProject, PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';

describe('ProjectDetailsSection', () => {
  let captured;
  let guard;

  const render = (project = buildProject()) => {
    guard = { leave: jasmine.createSpy('leave'), forceLeave: jasmine.createSpy('forceLeave') };
    spyOn(ProjectDetailsHelper, 'render').and.callFake((state, handlers) => {
      captured = { state, handlers };
      return React.createElement('div');
    });
    renderToStaticMarkup(React.createElement(ProjectDetailsSection, {
      project, guard, onDirtyChange: () => undefined, onNotFound: () => undefined,
    }));
  };

  it('starts with the project\'s name and description', () => {
    render(buildProject({ name: 'Kerghan', description: 'Desc' }));

    expect(captured.state).toEqual({
      name: 'Kerghan', description: 'Desc', fieldErrors: {}, formError: null, submitting: false,
    });
  });

  it('starts with an empty description for a project without one', () => {
    render(buildProject({ description: null }));

    expect(captured.state.description).toBe('');
  });

  it('goes back to the project page on Cancel, through the guard', () => {
    render();

    captured.handlers.onCancel();

    expect(guard.leave).toHaveBeenCalledOnceWith(`#/projects/${PROJECT_ID}`);
  });
});
