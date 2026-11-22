import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProjectHeader from '../../../../../../../../assets/js/components/resources/projects/pages/show/ProjectHeader.jsx';
import ProjectHeaderHelper from '../../../../../../../../assets/js/components/resources/projects/pages/show/ProjectHeaderHelper.jsx';
import ProjectRefreshController from '../../../../../../../../assets/js/components/resources/projects/pages/show/ProjectRefreshController.js';
import { buildProject } from '../../../../../../../support/issuesBuilders.js';

describe('ProjectHeader', () => {
  let captured;
  const project = buildProject();
  const onImport = () => undefined;

  beforeEach(() => {
    spyOn(ProjectHeaderHelper, 'render').and.callFake((state, handlers) => {
      captured = { state, handlers };
      return React.createElement('div');
    });
    renderToStaticMarkup(React.createElement(ProjectHeader, {
      project, onImport, onReloadList: () => undefined, onReloadProject: () => undefined,
    }));
  });

  it('starts idle: not refreshing, no notice, no error, no countdown', () => {
    expect(captured.state).toEqual({
      project, refreshing: false, notice: null, error: null, countdown: { active: false, secondsLeft: 0, label: null },
    });
  });

  it('hands the import callback on and refreshes through the controller', () => {
    spyOn(ProjectRefreshController.prototype, 'refresh').and.resolveTo();

    captured.handlers.onRefresh();

    expect(captured.handlers.onImport).toBe(onImport);
    expect(ProjectRefreshController.prototype.refresh).toHaveBeenCalledOnceWith(project.id);
  });
});
