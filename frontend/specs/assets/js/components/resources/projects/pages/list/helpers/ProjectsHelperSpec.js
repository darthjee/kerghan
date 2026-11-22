import React from 'react';
import ProjectsEmptyStateHelper from '../../../../../../../../../assets/js/components/resources/projects/pages/list/helpers/ProjectsEmptyStateHelper.jsx';
import ProjectsHelper from '../../../../../../../../../assets/js/components/resources/projects/pages/list/helpers/ProjectsHelper.jsx';
import ProjectsPaginationHelper from '../../../../../../../../../assets/js/components/resources/projects/pages/list/helpers/ProjectsPaginationHelper.jsx';
import ProjectsTableHelper from '../../../../../../../../../assets/js/components/resources/projects/pages/list/helpers/ProjectsTableHelper.jsx';
import ProjectsToolbarHelper from '../../../../../../../../../assets/js/components/resources/projects/pages/list/helpers/ProjectsToolbarHelper.jsx';
import { findElements } from '../../../../../../../../support/elementTree.js';
import { buildPagination, buildProject } from '../../../../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

describe('ProjectsHelper', () => {
  const handlers = { onRetry: jasmine.createSpy('onRetry') };
  const buildState = (overrides = {}) => ({
    listing: { projects: [buildProject()], pagination: buildPagination() },
    query: { page: 1, search: '' },
    loadState: { loading: false, error: null },
    notice: null,
    ...overrides,
  });
  const outputOf = (state) => renderedOutput(React.createElement('div', null, ProjectsHelper.render(state, handlers)));

  beforeEach(() => {
    spyOn(ProjectsToolbarHelper, 'render').and.returnValue(React.createElement('div', null, 'toolbar'));
    spyOn(ProjectsTableHelper, 'render').and.returnValue(React.createElement('div', null, 'table'));
    spyOn(ProjectsEmptyStateHelper, 'render').and.returnValue(React.createElement('div', null, 'empty'));
    spyOn(ProjectsPaginationHelper, 'render').and.returnValue(React.createElement('div', null, 'pagination'));
  });

  it('titles the page Projects', () => {
    expect(outputOf(buildState()).containsElement('h1', 'Projects')).toBe(true);
  });

  it('shows "Loading projects…" while loading, with no toolbar', () => {
    const output = outputOf(buildState({ loadState: { loading: true, error: null } }));

    expect(output.contains('Loading projects…')).toBe(true);
    expect(output.contains('toolbar')).toBe(false);
  });

  it('shows a danger alert with a working Retry on a load error', () => {
    const tree = ProjectsHelper.render(buildState({ loadState: { loading: false, error: 'Boom' } }), handlers);
    const [alert] = findElements(tree, (node) => node.props?.role === 'alert');
    const [retry] = findElements(alert, (node) => node.type === 'button');

    expect(alert.props.className).toContain('alert-danger');
    expect(alert.props.children[0]).toBe('Boom');
    expect(retry.props.children).toBe('Retry');
    expect(retry.props.onClick).toBe(handlers.onRetry);
  });

  it('renders the toolbar, table and pagination when there are rows', () => {
    const state = buildState();
    const output = outputOf(state);

    expect(output.containsInOrder('toolbar', 'table', 'pagination')).toBe(true);
    expect(ProjectsTableHelper.render).toHaveBeenCalledWith(state.listing.projects);
    expect(ProjectsToolbarHelper.render).toHaveBeenCalledWith(state.query, handlers);
    expect(ProjectsPaginationHelper.render).toHaveBeenCalledWith(state.listing.pagination, handlers);
    expect(ProjectsEmptyStateHelper.render).not.toHaveBeenCalled();
  });

  it('renders the empty state, keeping the toolbar, when there are no rows', () => {
    const state = buildState({ listing: { projects: [], pagination: buildPagination({ total: 0, totalPages: 0 }) } });
    const output = outputOf(state);

    expect(output.containsInOrder('toolbar', 'empty')).toBe(true);
    expect(ProjectsEmptyStateHelper.render).toHaveBeenCalledWith(state.query);
    expect(ProjectsTableHelper.render).not.toHaveBeenCalled();
  });

  describe('the one-time notice', () => {
    it('shows each line in a status alert', () => {
      const output = outputOf(buildState({
        notice: ['Project deleted.', '2 issues had changes that were not sent to GitHub.'],
      }));

      expect(output.contains('Project deleted.')).toBe(true);
      expect(output.contains('2 issues had changes that were not sent to GitHub.')).toBe(true);
      expect(output.containsAttribute('role', 'status')).toBe(true);
    });

    it('shows nothing without a notice', () => {
      expect(outputOf(buildState()).containsAttribute('role', 'status')).toBe(false);
    });
  });
});
