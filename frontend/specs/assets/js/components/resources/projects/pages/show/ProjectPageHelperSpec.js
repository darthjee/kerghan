import React from 'react';
import LoadErrorHelper from '../../../../../../../../assets/js/components/resources/projects/pages/common/LoadErrorHelper.jsx';
import NotFoundHelper from '../../../../../../../../assets/js/components/resources/projects/pages/common/NotFoundHelper.jsx';
import ImportIssueModal from '../../../../../../../../assets/js/components/resources/issues/link/modals/ImportIssueModal.jsx';
import IssueList from '../../../../../../../../assets/js/components/resources/issues/list/IssueList.jsx';
import ProjectHeader from '../../../../../../../../assets/js/components/resources/projects/pages/show/ProjectHeader.jsx';
import { findElements } from '../../../../../../../support/elementTree.js';
import ProjectHeaderHelper from '../../../../../../../../assets/js/components/resources/projects/pages/show/ProjectHeaderHelper.jsx';
import ProjectPageHelper from '../../../../../../../../assets/js/components/resources/projects/pages/show/ProjectPageHelper.jsx';
import { buildProject } from '../../../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('ProjectPageHelper', () => {
  const handlers = {
    onRetry: jasmine.createSpy('onRetry'),
    onImport: jasmine.createSpy('onImport'),
    onCloseImport: jasmine.createSpy('onCloseImport'),
    onReloadList: jasmine.createSpy('onReloadList'),
    onReloadProject: jasmine.createSpy('onReloadProject'),
  };
  const listRef = { current: null };
  const stateWith = (loadState, project = null) => ({
    project, loadState: { loading: false, error: null, notFound: false, ...loadState }, importing: false, listRef,
  });

  beforeEach(() => {
    spyOn(NotFoundHelper, 'render').and.returnValue(React.createElement('div', null, 'not-found'));
    spyOn(LoadErrorHelper, 'render').and.returnValue(React.createElement('div', null, 'load-error'));
    spyOn(ProjectHeaderHelper, 'render').and.returnValue(React.createElement('div', null, 'header'));
  });

  it('shows "Loading project…" while loading', () => {
    const output = renderedOutput(ProjectPageHelper.render(stateWith({ loading: true }), handlers));

    expect(output.contains('Loading project…')).toBe(true);
    expect(ProjectHeaderHelper.render).not.toHaveBeenCalled();
  });

  it('shows "Project not found" with a link back to the list', () => {
    renderedOutput(ProjectPageHelper.render(stateWith({ notFound: true }), handlers));

    expect(NotFoundHelper.render).toHaveBeenCalledOnceWith(
      'Project not found', { href: '#/projects', text: 'Back to projects' },
    );
  });

  it('shows the load error with Retry', () => {
    renderedOutput(ProjectPageHelper.render(stateWith({ error: 'Boom' }), handlers));

    expect(LoadErrorHelper.render).toHaveBeenCalledOnceWith('Boom', handlers.onRetry);
  });

  it('shows the header of the loaded project', () => {
    const project = buildProject();
    const output = renderedOutput(ProjectPageHelper.render(stateWith({}, project), handlers));

    expect(output.contains('header')).toBe(true);
    expect(ProjectHeaderHelper.render).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ project, refreshing: false, notice: null, error: null }),
      jasmine.any(Object),
    );
  });

  it('mounts the issue list below the header', () => {
    const output = renderedOutput(ProjectPageHelper.render(stateWith({}, buildProject()), handlers));

    expect(output.containsInOrder('header', 'Loading issues…')).toBe(true);
  });

  describe('the page tree', () => {
    const treeOf = (overrides, project = buildProject()) => ProjectPageHelper.render({ ...stateWith({}, project), ...overrides }, handlers);
    const find = (tree, type) => findElements(tree, (node) => node.type === type);

    it('hands the header the project and the callbacks', () => {
      const project = buildProject();
      const [header] = find(treeOf({}, project), ProjectHeader);

      expect(header.props).toEqual({
        project, onImport: handlers.onImport, onReloadList: handlers.onReloadList, onReloadProject: handlers.onReloadProject,
      });
    });

    it('hands the list its project, the import entry and the ref (T3, focus)', () => {
      const project = buildProject();
      const [list] = find(treeOf({}, project), IssueList);

      expect(list.props).toEqual({
        projectId: project.id, canImport: true, onImport: handlers.onImport, listRef,
      });
    });

    it('offers no import entry to a project without a repository', () => {
      expect(find(treeOf({}, buildProject({ repository: null })), IssueList)[0].props.canImport).toBeFalse();
    });

    it('shows the import modal only while importing, for the project repository', () => {
      const project = buildProject();

      expect(find(treeOf({ importing: false }, project), ImportIssueModal)).toEqual([]);

      const [modal] = find(treeOf({ importing: true }, project), ImportIssueModal);

      expect(modal.props).toEqual({ projectId: project.id, repository: project.repository, onClose: handlers.onCloseImport });
    });
  });
});
