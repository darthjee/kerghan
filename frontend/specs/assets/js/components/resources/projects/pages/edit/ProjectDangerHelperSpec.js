import ConfirmModal from '../../../../../../../../assets/js/components/common/confirmModal/ConfirmModal.jsx';
import ProjectDangerHelper from '../../../../../../../../assets/js/components/resources/projects/pages/edit/ProjectDangerHelper.jsx';
import { findElements } from '../../../../../../../support/elementTree.js';
import { buildProject } from '../../../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('ProjectDangerHelper', () => {
  const handlers = () => ({
    onOpen: jasmine.createSpy('onOpen'), onDelete: jasmine.createSpy('onDelete'), onCancel: jasmine.createSpy('onCancel'),
  });
  const stateWith = (overrides = {}) => ({ project: buildProject({ name: 'Kerghan' }), confirming: false, ...overrides });
  const modalOf = (tree) => findElements(tree, (node) => node.type === ConfirmModal)[0];

  it('shows a Danger zone with a warning and a Delete project button wired to onOpen', () => {
    const given = handlers();
    const tree = ProjectDangerHelper.render(stateWith(), given);
    const output = renderedOutput(tree);
    const [button] = findElements(tree, (node) => node.type === 'button');

    expect(output.containsElement('h2', 'Danger zone')).toBe(true);
    expect(button.props.children).toBe('Delete project');
    expect(button.props.onClick).toBe(given.onOpen);
  });

  it('warns in general terms, with no count', () => {
    const output = renderedOutput(ProjectDangerHelper.render(stateWith({ project: buildProject({ openIssueCount: 9 }) }), handlers()));

    expect(output.contains('permanently deletes the project, all its issues and their GitHub links')).toBe(true);
    expect(output.contains('not yet sent to GitHub are lost')).toBe(true);
    expect(output.contains('>9<')).toBe(false);
    expect(output.contains('9 issues')).toBe(false);
  });

  it('opens no confirmation by default', () => {
    expect(modalOf(ProjectDangerHelper.render(stateWith(), handlers()))).toBeUndefined();
  });

  describe('the confirmation', () => {
    it('is a danger ConfirmModal named "Delete project" needing the project name typed (U9)', () => {
      const given = handlers();
      const modal = modalOf(ProjectDangerHelper.render(stateWith({ confirming: true }), given));

      expect(modal.props.title).toBe('Delete project');
      expect(modal.props.confirmLabel).toBe('Delete project');
      expect(modal.props.danger).toBe(true);
      expect(modal.props.typeToConfirm).toBe('Kerghan');
      expect(modal.props.onConfirm).toBe(given.onDelete);
      expect(modal.props.onCancel).toBe(given.onCancel);
    });

    it('warns that issues and links are deleted and unsent changes are lost, with no count', () => {
      const modal = modalOf(ProjectDangerHelper.render(stateWith({ confirming: true }), handlers()));

      expect(modal.props.message).toContain('all its issues and their GitHub links');
      expect(modal.props.message).toContain('Changes not yet sent to GitHub are lost');
      expect(modal.props.message).not.toMatch(/\d/);
    });
  });
});
