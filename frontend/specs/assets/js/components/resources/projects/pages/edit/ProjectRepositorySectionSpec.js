import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProjectRepositoryController from '../../../../../../../../assets/js/components/resources/projects/pages/edit/ProjectRepositoryController.js';
import ProjectRepositoryHelper from '../../../../../../../../assets/js/components/resources/projects/pages/edit/ProjectRepositoryHelper.jsx';
import ProjectRepositorySection from '../../../../../../../../assets/js/components/resources/projects/pages/edit/ProjectRepositorySection.jsx';
import { buildProject, PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';

describe('ProjectRepositorySection', () => {
  let captured;

  const render = (project = buildProject()) => {
    spyOn(ProjectRepositoryHelper, 'render').and.callFake((state, handlers) => {
      captured = { state, handlers };
      return React.createElement('div');
    });
    renderToStaticMarkup(React.createElement(ProjectRepositorySection, {
      project, onProjectChange: () => undefined, onNotFound: () => undefined,
    }));
  };

  it('starts idle, showing the project\'s repository', () => {
    const project = buildProject();

    render(project);

    expect(captured.state).toEqual({
      repository: project.repository, picking: false, confirmingDetach: false, pending: false, error: null,
    });
  });

  it('routes the actions to the controller with the project id', () => {
    spyOn(ProjectRepositoryController.prototype, 'openPicker');
    spyOn(ProjectRepositoryController.prototype, 'closePicker');
    spyOn(ProjectRepositoryController.prototype, 'pick').and.resolveTo();
    spyOn(ProjectRepositoryController.prototype, 'detach').and.resolveTo();
    spyOn(ProjectRepositoryController.prototype, 'confirmDetach');
    render();

    captured.handlers.onOpenPicker();
    captured.handlers.onClosePicker();
    captured.handlers.onPick({ githubId: 1 });
    captured.handlers.onDetach();
    captured.handlers.onConfirmDetach();
    captured.handlers.onCancelDetach();

    expect(ProjectRepositoryController.prototype.openPicker).toHaveBeenCalled();
    expect(ProjectRepositoryController.prototype.closePicker).toHaveBeenCalled();
    expect(ProjectRepositoryController.prototype.pick).toHaveBeenCalledWith(PROJECT_ID, { githubId: 1 });
    expect(ProjectRepositoryController.prototype.detach).toHaveBeenCalledWith(PROJECT_ID);
    expect(ProjectRepositoryController.prototype.confirmDetach.calls.allArgs()).toEqual([[true], [false]]);
  });
});
