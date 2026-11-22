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

    expect(state).toEqual({
      project: null,
      loadState: { loading: true, error: null, notFound: false },
      importing: false,
      listRef: { current: null },
    });
  });

  it('retries through the controller', () => {
    spyOn(ProjectLoadController.prototype, 'retry').and.resolveTo();
    const { handlers } = render(`#/projects/${PROJECT_ID}`);

    handlers.onRetry();

    expect(ProjectLoadController.prototype.retry).toHaveBeenCalled();
  });

  it('re-reads the project quietly through the controller', () => {
    spyOn(ProjectLoadController.prototype, 'reread').and.resolveTo();
    const { handlers } = render(`#/projects/${PROJECT_ID}`);

    handlers.onReloadProject();

    expect(ProjectLoadController.prototype.reread).toHaveBeenCalled();
  });

  it('re-reads the list through its ref, and not at all before the list mounted', () => {
    const { state, handlers } = render(`#/projects/${PROJECT_ID}`);

    expect(() => handlers.onReloadList()).not.toThrow();
    state.listRef.current = jasmine.createSpyObj('list', ['load']);
    handlers.onReloadList();

    expect(state.listRef.current.load).toHaveBeenCalledTimes(1);
  });

  it('opens and closes the import modal state through its handlers', () => {
    const { handlers } = render(`#/projects/${PROJECT_ID}`);

    expect(handlers.onImport).toEqual(jasmine.any(Function));
    expect(handlers.onCloseImport).toEqual(jasmine.any(Function));
  });
});
