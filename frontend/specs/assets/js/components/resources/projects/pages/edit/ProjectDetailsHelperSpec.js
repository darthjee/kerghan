import ProjectDetailsHelper from '../../../../../../../../assets/js/components/resources/projects/pages/edit/ProjectDetailsHelper.jsx';
import { findElements } from '../../../../../../../support/elementTree.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('ProjectDetailsHelper', () => {
  const handlers = () => ({
    onNameChange: jasmine.createSpy('onNameChange'),
    onDescriptionChange: jasmine.createSpy('onDescriptionChange'),
    onSubmit: jasmine.createSpy('onSubmit'),
    onCancel: jasmine.createSpy('onCancel'),
  });
  const stateWith = (overrides = {}) => ({
    name: 'Kerghan', description: 'Desc', fieldErrors: {}, formError: null, submitting: false, ...overrides,
  });
  const buttons = (tree) => findElements(tree, (node) => node.type === 'button');

  it('renders the Details heading, the fields and Save and Cancel', () => {
    const output = renderedOutput(ProjectDetailsHelper.render(stateWith(), handlers()));

    expect(output.containsElement('h2', 'Details')).toBe(true);
    expect(output.containsAttribute('id', 'project-name')).toBe(true);
    expect(output.containsAttribute('id', 'project-description')).toBe(true);
    expect(output.contains('Save')).toBe(true);
    expect(output.contains('Cancel')).toBe(true);
  });

  it('wires submit, Cancel and the field handlers', () => {
    const given = handlers();
    const tree = ProjectDetailsHelper.render(stateWith(), given);

    expect(findElements(tree, (node) => node.type === 'form')[0].props.onSubmit).toBe(given.onSubmit);
    expect(buttons(tree).find((button) => button.props.children === 'Cancel').props.onClick).toBe(given.onCancel);
    expect(findElements(tree, (node) => node.props?.id === 'project-name')[0].props.onChange).toBe(given.onNameChange);
    expect(findElements(tree, (node) => node.props?.id === 'project-description')[0].props.onChange).toBe(given.onDescriptionChange);
  });

  it('shows the Name error and the form-level error', () => {
    const output = renderedOutput(ProjectDetailsHelper.render(
      stateWith({ fieldErrors: { name: { message: 'taken' } }, formError: { message: 'GitHub down' } }), handlers(),
    ));

    expect(output.contains('taken')).toBe(true);
    expect(output.contains('GitHub down')).toBe(true);
  });

  it('disables both buttons with a spinner while saving (U2)', () => {
    const tree = ProjectDetailsHelper.render(stateWith({ submitting: true }), handlers());

    expect(buttons(tree).every((button) => button.props.disabled)).toBe(true);
    expect(renderedOutput(tree).contains('spinner-border')).toBe(true);
  });
});
