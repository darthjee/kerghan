import React from 'react';
import IssuesEmptyStateHelper from '../../../../../../../../assets/js/components/resources/issues/list/helpers/IssuesEmptyStateHelper.jsx';
import IssuesHelper from '../../../../../../../../assets/js/components/resources/issues/list/helpers/IssuesHelper.jsx';
import IssuesPaginationHelper from '../../../../../../../../assets/js/components/resources/issues/list/helpers/IssuesPaginationHelper.jsx';
import IssuesTableHelper from '../../../../../../../../assets/js/components/resources/issues/list/helpers/IssuesTableHelper.jsx';
import IssuesToolbarHelper from '../../../../../../../../assets/js/components/resources/issues/list/helpers/IssuesToolbarHelper.jsx';
import { findElements } from '../../../../../../../support/elementTree.js';
import { buildIssue, buildPagination, PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('IssuesHelper', () => {
  const handlers = { onRetry: jasmine.createSpy('onRetry') };
  const stateWith = ({ loadState, issues = [buildIssue()], query } = {}) => ({
    projectId: PROJECT_ID,
    listing: { issues, pagination: buildPagination() },
    query: { state: 'open', page: 1, search: '', ...query },
    loadState: { loading: false, error: null, ...loadState },
  });
  const outputOf = (state) => renderedOutput(IssuesHelper.render(state, handlers));

  beforeEach(() => {
    spyOn(IssuesToolbarHelper, 'render').and.returnValue(React.createElement('div', null, 'toolbar'));
    spyOn(IssuesTableHelper, 'render').and.returnValue(React.createElement('div', null, 'table'));
    spyOn(IssuesEmptyStateHelper, 'render').and.returnValue(React.createElement('div', null, 'empty'));
    spyOn(IssuesPaginationHelper, 'render').and.returnValue(React.createElement('div', null, 'pagination'));
  });

  it('shows "Loading issues…" while loading', () => {
    const output = outputOf(stateWith({ loadState: { loading: true } }));

    expect(output.contains('Loading issues…')).toBe(true);
    expect(IssuesToolbarHelper.render).not.toHaveBeenCalled();
  });

  it('shows a danger alert with the message and a Retry button on failure', () => {
    const tree = IssuesHelper.render(stateWith({ loadState: { error: 'Boom' } }), handlers);
    const [button] = findElements(tree, (node) => node.type === 'button');

    expect(renderedOutput(tree).containsAttribute('class', 'alert alert-danger')).toBe(true);
    expect(renderedOutput(tree).contains('Boom')).toBe(true);
    expect(button.props.onClick).toBe(handlers.onRetry);
  });

  it('shows the toolbar, the table and the pagination when there are rows', () => {
    const output = outputOf(stateWith());

    expect(output.containsInOrder('toolbar', 'table', 'pagination')).toBe(true);
    expect(IssuesEmptyStateHelper.render).not.toHaveBeenCalled();
  });

  it('shows the empty state for the query when there are no rows', () => {
    const state = stateWith({ issues: [], query: { state: 'closed' } });

    expect(outputOf(state).containsInOrder('toolbar', 'empty')).toBe(true);
    expect(IssuesEmptyStateHelper.render).toHaveBeenCalledOnceWith(PROJECT_ID, state.query, { canImport: undefined, onImport: handlers.onImport });
    expect(IssuesTableHelper.render).not.toHaveBeenCalled();
  });

  it('hands the empty state the import entry of a project with a repository', () => {
    const state = { ...stateWith({ issues: [], query: { state: 'open' } }), canImport: true };

    outputOf(state);

    expect(IssuesEmptyStateHelper.render).toHaveBeenCalledOnceWith(PROJECT_ID, state.query, { canImport: true, onImport: handlers.onImport });
  });
});
