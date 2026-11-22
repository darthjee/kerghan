import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProjectDeleteController from '../../../../../../../../assets/js/components/resources/projects/pages/edit/ProjectDeleteController.js';
import ProjectDangerHelper from '../../../../../../../../assets/js/components/resources/projects/pages/edit/ProjectDangerHelper.jsx';
import ProjectDangerZone from '../../../../../../../../assets/js/components/resources/projects/pages/edit/ProjectDangerZone.jsx';
import { buildProject, PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';

describe('ProjectDangerZone', () => {
  let captured;
  let guard;
  const project = buildProject();

  beforeEach(() => {
    guard = { forceLeave: jasmine.createSpy('forceLeave') };
    spyOn(ProjectDangerHelper, 'render').and.callFake((state, handlers) => {
      captured = { state, handlers };
      return React.createElement('div');
    });
    renderToStaticMarkup(React.createElement(ProjectDangerZone, { project, guard }));
  });

  it('starts with the confirmation closed', () => {
    expect(captured.state).toEqual({ project, confirming: false });
  });

  it('deletes through the controller, leaving without the unsaved-changes prompt', () => {
    spyOn(ProjectDeleteController.prototype, 'remove').and.resolveTo();

    captured.handlers.onDelete();

    expect(ProjectDeleteController.prototype.remove).toHaveBeenCalledOnceWith(PROJECT_ID, guard.forceLeave);
  });
});
