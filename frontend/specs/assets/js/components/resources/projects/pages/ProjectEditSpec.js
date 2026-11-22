import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProjectEdit from '../../../../../../../assets/js/components/resources/projects/pages/ProjectEdit.jsx';
import ProjectLoadController from '../../../../../../../assets/js/components/resources/projects/pages/common/ProjectLoadController.js';
import ProjectEditHelper from '../../../../../../../assets/js/components/resources/projects/pages/edit/ProjectEditHelper.jsx';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';
import { PROJECT_ID } from '../../../../../../support/issuesBuilders.js';

describe('ProjectEdit', () => {
  let captured;

  beforeEach(() => {
    installFakeWindow({ location: { hash: `#/projects/${PROJECT_ID}/edit` } });
    spyOn(ProjectEditHelper, 'render').and.callFake((state, handlers) => {
      captured = { state, handlers };
      return React.createElement('div');
    });
    renderToStaticMarkup(React.createElement(ProjectEdit));
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  it('starts loading, with no project and a guard with nothing pending', () => {
    expect(captured.state.project).toBeNull();
    expect(captured.state.loadState).toEqual({ loading: true, error: null, notFound: false });
    expect(captured.state.guard.pendingHash).toBeNull();
  });

  it('retries through the controller', () => {
    spyOn(ProjectLoadController.prototype, 'retry').and.resolveTo();

    captured.handlers.onRetry();

    expect(ProjectLoadController.prototype.retry).toHaveBeenCalled();
  });

  it('offers the sections the callbacks they need', () => {
    expect(captured.handlers).toEqual(jasmine.objectContaining({
      onProjectChange: jasmine.any(Function), onNotFound: jasmine.any(Function), onDirtyChange: jasmine.any(Function),
    }));
  });
});
