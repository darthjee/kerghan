import ProjectFieldsHelper from '../../../../../../../../assets/js/components/resources/projects/pages/common/ProjectFieldsHelper.jsx';
import { findElements } from '../../../../../../../support/elementTree.js';

describe('ProjectFieldsHelper', () => {
  const state = (overrides = {}) => ({ name: 'N', description: 'D', fieldErrors: {}, ...overrides });
  const handlers = { onNameChange: () => undefined, onDescriptionChange: () => undefined };

  it('renders the Name input, labelled, with its value and handler', () => {
    const tree = ProjectFieldsHelper.renderName(state(), handlers);
    const [input] = findElements(tree, (node) => node.type === 'input');

    expect(input.props.id).toBe('project-name');
    expect(input.props.value).toBe('N');
    expect(input.props.onChange).toBe(handlers.onNameChange);
    expect(findElements(tree, (node) => node.type === 'label')[0].props.htmlFor).toBe('project-name');
  });

  it('renders the Description textarea with its value and handler', () => {
    const [area] = findElements(ProjectFieldsHelper.renderDescription(state(), handlers), (node) => node.type === 'textarea');

    expect(area.props.id).toBe('project-description');
    expect(area.props.value).toBe('D');
    expect(area.props.onChange).toBe(handlers.onDescriptionChange);
  });

  it('marks a field invalid and shows its error', () => {
    const fieldErrors = { name: { message: 'Name is required' }, description: { message: 'Too long' } };
    const name = ProjectFieldsHelper.renderName(state({ fieldErrors }), handlers);
    const description = ProjectFieldsHelper.renderDescription(state({ fieldErrors }), handlers);

    expect(findElements(name, (node) => node.type === 'input')[0].props.className).toContain('is-invalid');
    expect(findElements(description, (node) => node.type === 'textarea')[0].props.className).toContain('is-invalid');
    expect(findElements(name, (node) => node.props?.error?.message === 'Name is required').length).toBe(1);
  });

  it('shows no error element for a valid field', () => {
    expect(ProjectFieldsHelper.renderFieldError(undefined)).toBeNull();
    expect(ProjectFieldsHelper.renderFormError(null)).toBeNull();
  });

  it('renders a form-level error as an alert', () => {
    const element = ProjectFieldsHelper.renderFormError({ message: 'Limit' });

    expect(element.props.role).toBe('alert');
    expect(element.props.className).toContain('alert-danger');
  });
});
