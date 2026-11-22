import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import IssueList, { buildStartEffect } from '../../../../../../../assets/js/components/resources/issues/list/IssueList.jsx';
import IssuesHelper from '../../../../../../../assets/js/components/resources/issues/list/helpers/IssuesHelper.jsx';
import { PROJECT_ID } from '../../../../../../support/issuesBuilders.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

describe('IssueList', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  it('starts in the loading state with the default query and an empty listing', () => {
    let state;
    let handlers;

    spyOn(IssuesHelper, 'render').and.callFake((helperState, helperHandlers) => {
      state = helperState;
      handlers = helperHandlers;
      return React.createElement('div');
    });

    renderToStaticMarkup(React.createElement(IssueList, { projectId: PROJECT_ID }));

    expect(state.projectId).toBe(PROJECT_ID);
    expect(state.loadState).toEqual({ loading: true, error: null });
    expect(state.query).toEqual({ state: 'open', page: 1, search: '' });
    expect(state.listing.issues).toEqual([]);
    expect(handlers).toEqual(jasmine.objectContaining({
      onSearchChange: jasmine.any(Function),
      onStateChange: jasmine.any(Function),
      onPageChange: jasmine.any(Function),
      onRetry: jasmine.any(Function),
    }));
  });

  it('shows "Loading issues…" first', () => {
    expect(renderToStaticMarkup(React.createElement(IssueList, { projectId: PROJECT_ID })))
      .toContain('Loading issues…');
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
