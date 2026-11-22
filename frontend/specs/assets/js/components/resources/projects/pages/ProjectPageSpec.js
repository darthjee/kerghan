import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProjectLoadController from '../../../../../../../assets/js/components/resources/projects/pages/common/ProjectLoadController.js';
import ProjectPage from '../../../../../../../assets/js/components/resources/projects/pages/ProjectPage.jsx';
import ProjectPageHelper from '../../../../../../../assets/js/components/resources/projects/pages/show/ProjectPageHelper.jsx';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';
import { PROJECT_ID } from '../../../../../../support/issuesBuilders.js';

describe('ProjectPage', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  const render = (hash) => {
    let captured;

    installFakeWindow({ location: { hash } });
    spyOn(ProjectPageHelper, 'render').and.callFake((state, handlers) => {
      captured = { state, handlers };
      return React.createElement('div');
    });
    renderToStaticMarkup(React.createElement(ProjectPage));
    return captured;
  };

  it('starts in the loading state with no project', () => {
    const { state } = render(`#/projects/${PROJECT_ID}`);

    expect(state).toEqual({ project: null, loadState: { loading: true, error: null, notFound: false } });
  });

  it('retries through the controller', () => {
    spyOn(ProjectLoadController.prototype, 'retry').and.resolveTo();
    const { handlers } = render(`#/projects/${PROJECT_ID}`);

    handlers.onRetry();

    expect(ProjectLoadController.prototype.retry).toHaveBeenCalled();
  });
});
