import React from 'react';
import DirtyFormPrompt from '../../../../../../../../assets/js/components/common/forms/DirtyFormPrompt.jsx';
import LoadErrorHelper from '../../../../../../../../assets/js/components/resources/projects/pages/common/LoadErrorHelper.jsx';
import NotFoundHelper from '../../../../../../../../assets/js/components/resources/projects/pages/common/NotFoundHelper.jsx';
import ProjectDangerZone from '../../../../../../../../assets/js/components/resources/projects/pages/edit/ProjectDangerZone.jsx';
import ProjectDetailsSection from '../../../../../../../../assets/js/components/resources/projects/pages/edit/ProjectDetailsSection.jsx';
import ProjectEditHelper from '../../../../../../../../assets/js/components/resources/projects/pages/edit/ProjectEditHelper.jsx';
import ProjectRepositorySection from '../../../../../../../../assets/js/components/resources/projects/pages/edit/ProjectRepositorySection.jsx';
import { findElements } from '../../../../../../../support/elementTree.js';
import { buildProject } from '../../../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('ProjectEditHelper', () => {
  const guard = { pendingHash: null };
  const handlers = {
    onRetry: jasmine.createSpy('onRetry'),
    onProjectChange: jasmine.createSpy('onProjectChange'),
    onNotFound: jasmine.createSpy('onNotFound'),
    onDirtyChange: jasmine.createSpy('onDirtyChange'),
  };
  const stateWith = (loadState, project = null) => ({
    project, guard, loadState: { loading: false, error: null, notFound: false, ...loadState },
  });

  it('shows "Loading project…" while loading', () => {
    expect(renderedOutput(ProjectEditHelper.render(stateWith({ loading: true }), handlers)).contains('Loading project…')).toBe(true);
  });

  it('shows "Project not found" (U1)', () => {
    spyOn(NotFoundHelper, 'render').and.returnValue(React.createElement('div'));

    ProjectEditHelper.render(stateWith({ notFound: true }), handlers);

    expect(NotFoundHelper.render).toHaveBeenCalledWith('Project not found', jasmine.objectContaining({ href: '#/projects' }));
  });

  it('shows the load error with Retry', () => {
    spyOn(LoadErrorHelper, 'render').and.returnValue(React.createElement('div'));

    ProjectEditHelper.render(stateWith({ error: 'Boom' }), handlers);

    expect(LoadErrorHelper.render).toHaveBeenCalledWith('Boom', handlers.onRetry);
  });

  describe('when loaded', () => {
    const project = buildProject();
    const tree = () => ProjectEditHelper.render(stateWith({}, project), handlers);
    const find = (type) => findElements(tree(), (node) => node.type === type)[0];

    it('composes the three sections in order, then the dirty-form prompt', () => {
      const types = findElements(tree(), (node) => [
        ProjectDetailsSection, ProjectRepositorySection, ProjectDangerZone, DirtyFormPrompt,
      ].includes(node.type)).map((node) => node.type);

      expect(types).toEqual([ProjectDetailsSection, ProjectRepositorySection, ProjectDangerZone, DirtyFormPrompt]);
    });

    it('hands each section what it needs', () => {
      expect(find(ProjectDetailsSection).props).toEqual(jasmine.objectContaining({
        project, guard, onDirtyChange: handlers.onDirtyChange, onNotFound: handlers.onNotFound,
      }));
      expect(find(ProjectRepositorySection).props).toEqual(jasmine.objectContaining({
        project, onProjectChange: handlers.onProjectChange, onNotFound: handlers.onNotFound,
      }));
      expect(find(ProjectDangerZone).props).toEqual(jasmine.objectContaining({ project, guard }));
      expect(find(DirtyFormPrompt).props.guard).toBe(guard);
    });
  });
});
