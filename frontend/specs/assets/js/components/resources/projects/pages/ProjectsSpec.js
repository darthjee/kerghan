import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Projects, { buildStartEffect } from '../../../../../../../assets/js/components/resources/projects/pages/Projects.jsx';
import ProjectsHelper from '../../../../../../../assets/js/components/resources/projects/pages/list/helpers/ProjectsHelper.jsx';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

describe('Projects', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  it('starts in the loading state with the default query and an empty listing', () => {
    let state;
    let handlers;

    spyOn(ProjectsHelper, 'render').and.callFake((helperState, helperHandlers) => {
      state = helperState;
      handlers = helperHandlers;
      return React.createElement('div');
    });

    renderToStaticMarkup(React.createElement(Projects));

    expect(state.loadState).toEqual({ loading: true, error: null });
    expect(state.query).toEqual({ page: 1, search: '' });
    expect(state.listing.projects).toEqual([]);
    expect(state.notice).toBeNull();
    expect(handlers).toEqual(jasmine.objectContaining({
      onSearchChange: jasmine.any(Function), onPageChange: jasmine.any(Function), onRetry: jasmine.any(Function),
    }));
  });

  describe('buildStartEffect', () => {
    let fakeWindow;
    let controller;

    beforeEach(() => {
      fakeWindow = installFakeWindow(new EventTarget());
      controller = jasmine.createSpyObj('controller', ['start', 'handleHashChange', 'dispose']);
    });

    it('starts the controller on mount', () => {
      buildStartEffect(controller)();

      expect(controller.start).toHaveBeenCalledTimes(1);
    });

    it('forwards hashchange events to the controller', () => {
      buildStartEffect(controller)();

      fakeWindow.dispatchEvent(new Event('hashchange'));

      expect(controller.handleHashChange).toHaveBeenCalledTimes(1);
    });

    it('stops listening and disposes the controller on cleanup', () => {
      const cleanup = buildStartEffect(controller)();

      cleanup();
      fakeWindow.dispatchEvent(new Event('hashchange'));

      expect(controller.dispose).toHaveBeenCalledTimes(1);
      expect(controller.handleHashChange).not.toHaveBeenCalled();
    });
  });
});
