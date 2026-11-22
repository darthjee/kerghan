import ProjectRepositoryHelper from '../../../../../../../../assets/js/components/resources/projects/pages/edit/ProjectRepositoryHelper.jsx';
import ConfirmModal from '../../../../../../../../assets/js/components/common/confirmModal/ConfirmModal.jsx';
import RepositoryPicker from '../../../../../../../../assets/js/components/resources/projects/repositoryPicker/RepositoryPicker.jsx';
import { findElements } from '../../../../../../../support/elementTree.js';
import { buildProjectRepository } from '../../../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('ProjectRepositoryHelper', () => {
  const handlers = () => ({
    onOpenPicker: jasmine.createSpy('onOpenPicker'),
    onClosePicker: jasmine.createSpy('onClosePicker'),
    onPick: jasmine.createSpy('onPick'),
    onConfirmDetach: jasmine.createSpy('onConfirmDetach'),
    onDetach: jasmine.createSpy('onDetach'),
    onCancelDetach: jasmine.createSpy('onCancelDetach'),
  });
  const stateWith = (overrides = {}) => ({
    repository: buildProjectRepository(), picking: false, confirmingDetach: false, pending: false, error: null, ...overrides,
  });
  const buttonLabels = (tree) => findElements(tree, (node) => node.type === 'button').map((button) => button.props.children);
  const button = (tree, label) => findElements(tree, (node) => node.type === 'button' && node.props.children === label)[0];

  describe('with a repository', () => {
    it('shows owner/name with its badge, and the Change and Detach actions', () => {
      const tree = ProjectRepositoryHelper.render(stateWith(), handlers());
      const output = renderedOutput(tree);

      expect(output.contains('darthjee/kerghan')).toBe(true);
      expect(output.containsElement('span', 'Added')).toBe(true);
      expect(buttonLabels(tree)).toEqual(['Change', 'Detach']);
    });

    it('wires Change and Detach', () => {
      const given = handlers();
      const tree = ProjectRepositoryHelper.render(stateWith(), given);

      expect(button(tree, 'Change').props.onClick).toBe(given.onOpenPicker);
      expect(button(tree, 'Detach').props.onClick).toBe(given.onConfirmDetach);
    });
  });

  describe('without a repository', () => {
    it('shows "No repository" and "Connect a repository", with no Detach', () => {
      const tree = ProjectRepositoryHelper.render(stateWith({ repository: null }), handlers());

      expect(renderedOutput(tree).contains('No repository')).toBe(true);
      expect(buttonLabels(tree)).toEqual(['Connect a repository']);
    });
  });

  it('never pre-disables the buttons by a guess about links', () => {
    const tree = ProjectRepositoryHelper.render(stateWith(), handlers());

    expect(findElements(tree, (node) => node.type === 'button').some((item) => item.props.disabled)).toBe(false);
  });

  it('disables the buttons while a call is in flight (U2)', () => {
    const tree = ProjectRepositoryHelper.render(stateWith({ pending: true }), handlers());

    expect(findElements(tree, (node) => node.type === 'button').every((item) => item.props.disabled)).toBe(true);
  });

  describe('while choosing', () => {
    it('shows the picker, wired to onPick, and a Cancel instead of the actions', () => {
      const given = handlers();
      const tree = ProjectRepositoryHelper.render(stateWith({ picking: true }), given);
      const [picker] = findElements(tree, (node) => node.type === RepositoryPicker);

      expect(picker.props.selected).toBeNull();
      expect(picker.props.onChange).toBe(given.onPick);
      expect(buttonLabels(tree)).toEqual(['Cancel']);
      expect(button(tree, 'Cancel').props.onClick).toBe(given.onClosePicker);
    });

    it('shows no picker otherwise', () => {
      expect(findElements(ProjectRepositoryHelper.render(stateWith(), handlers()), (node) => node.type === RepositoryPicker)).toEqual([]);
    });
  });

  describe('the section error', () => {
    it('shows PROJECT_HAS_LINKS\'s sentence in an alert', () => {
      const output = renderedOutput(ProjectRepositoryHelper.render(
        stateWith({ error: { message: '3 linked issues use this repository; unlink them before changing it' } }), handlers(),
      ));

      expect(output.contains('3 linked issues use this repository; unlink them before changing it')).toBe(true);
      expect(output.containsAttribute('role', 'alert')).toBe(true);
    });

    it('shows a link to the existing project', () => {
      const output = renderedOutput(ProjectRepositoryHelper.render(
        stateWith({ error: { message: 'Taken', link: { href: '#/projects/abc', text: 'Open the existing project' } } }), handlers(),
      ));

      expect(output.containsAttribute('href', '#/projects/abc')).toBe(true);
    });

    it('shows no alert without an error', () => {
      expect(renderedOutput(ProjectRepositoryHelper.render(stateWith(), handlers())).containsAttribute('role', 'alert')).toBe(false);
    });
  });

  describe('the Detach confirmation', () => {
    it('is a danger ConfirmModal named "Detach", wired to the handlers', () => {
      const given = handlers();
      const [modal] = findElements(
        ProjectRepositoryHelper.render(stateWith({ confirmingDetach: true }), given), (node) => node.type === ConfirmModal,
      );

      expect(modal.props.confirmLabel).toBe('Detach');
      expect(modal.props.danger).toBe(true);
      expect(modal.props.typeToConfirm).toBeUndefined();
      expect(modal.props.onConfirm).toBe(given.onDetach);
      expect(modal.props.onCancel).toBe(given.onCancelDetach);
    });

    it('is not rendered while closed', () => {
      expect(findElements(ProjectRepositoryHelper.render(stateWith(), handlers()), (node) => node.type === ConfirmModal)).toEqual([]);
    });
  });
});
