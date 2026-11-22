import React from 'react';
import ProjectNewHelper from '../../../../../../../../assets/js/components/resources/projects/pages/new/ProjectNewHelper.jsx';
import RepositoryPicker from '../../../../../../../../assets/js/components/resources/projects/repositoryPicker/RepositoryPicker.jsx';
import { findElements } from '../../../../../../../support/elementTree.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('ProjectNewHelper', () => {
  const handlers = () => ({
    onNameChange: jasmine.createSpy('onNameChange'),
    onDescriptionChange: jasmine.createSpy('onDescriptionChange'),
    onRepositoryChange: jasmine.createSpy('onRepositoryChange'),
    onSubmit: jasmine.createSpy('onSubmit'),
    onCancel: jasmine.createSpy('onCancel'),
  });
  const stateWith = (overrides = {}) => ({
    name: '', description: '', repository: null, fieldErrors: {}, formError: null, submitting: false, ...overrides,
  });
  const treeOf = (overrides, given = handlers()) => ProjectNewHelper.render(stateWith(overrides), given);
  const outputOf = (overrides) => renderedOutput(treeOf(overrides));

  it('renders the Name, Description and Repository fields with their labels', () => {
    const output = outputOf();

    expect(output.containsElement('h1', 'New project')).toBe(true);
    ['Name', 'Description', 'Repository'].forEach((label) => expect(output.containsElement('label', label)).toBe(true));
  });

  it('shows the typed values and wires the change handlers', () => {
    const given = handlers();
    const tree = treeOf({ name: 'Kerghan', description: 'Desc' }, given);
    const [name] = findElements(tree, (node) => node.props?.id === 'project-name');
    const [description] = findElements(tree, (node) => node.props?.id === 'project-description');

    expect(name.props.value).toBe('Kerghan');
    expect(name.props.onChange).toBe(given.onNameChange);
    expect(description.props.value).toBe('Desc');
    expect(description.props.onChange).toBe(given.onDescriptionChange);
  });

  it('hands the chosen repository and its change handler to the picker', () => {
    const given = handlers();
    const repository = { githubId: 1, fullName: 'a/b' };
    const [picker] = findElements(treeOf({ repository }, given), (node) => node.type === RepositoryPicker);

    expect(picker.props.selected).toBe(repository);
    expect(picker.props.onChange).toBe(given.onRepositoryChange);
  });

  it('submits the form and wires Cancel', () => {
    const given = handlers();
    const tree = treeOf({}, given);
    const [form] = findElements(tree, (node) => node.type === 'form');
    const cancel = findElements(tree, (node) => node.type === 'button').find((button) => button.props.children === 'Cancel');

    expect(form.props.onSubmit).toBe(given.onSubmit);
    expect(cancel.props.onClick).toBe(given.onCancel);
  });

  describe('field errors', () => {
    it('shows the Name error under the Name field and marks it invalid', () => {
      const tree = treeOf({ fieldErrors: { name: { message: 'Name is required' } } });
      const [name] = findElements(tree, (node) => node.props?.id === 'project-name');

      expect(name.props.className).toContain('is-invalid');
      expect(renderedOutput(tree).contains('Name is required')).toBe(true);
    });

    it('shows the Repository error with its link to the existing project', () => {
      const output = outputOf({
        fieldErrors: { repository: { message: 'Taken', link: { href: '#/projects/abc', text: 'Open the existing project' } } },
      });

      expect(output.contains('Taken')).toBe(true);
      expect(output.containsAttribute('href', '#/projects/abc')).toBe(true);
    });

    it('shows no error by default', () => {
      expect(outputOf().contains('invalid-feedback')).toBe(false);
    });
  });

  describe('form-level error', () => {
    it('shows an alert with the message and its details', () => {
      const output = outputOf({ formError: { message: 'Limit', details: ['one'] } });

      expect(output.containsAttribute('role', 'alert')).toBe(true);
      expect(output.contains('Limit')).toBe(true);
      expect(output.containsElement('li', 'one')).toBe(true);
    });

    it('shows no alert without an error', () => {
      expect(outputOf().containsAttribute('role', 'alert')).toBe(false);
    });
  });

  describe('in flight (U2)', () => {
    it('disables both buttons and shows a spinner', () => {
      const tree = treeOf({ submitting: true });
      const buttons = findElements(tree, (node) => node.type === 'button');

      expect(buttons.every((button) => button.props.disabled)).toBe(true);
      expect(renderedOutput(tree).contains('spinner-border')).toBe(true);
    });

    it('leaves them enabled otherwise', () => {
      const buttons = findElements(treeOf(), (node) => node.type === 'button');

      expect(buttons.some((button) => button.props.disabled)).toBe(false);
      expect(outputOf().contains('spinner-border')).toBe(false);
    });
  });

  it('renders typed values and errors as text, never as markup (S1)', () => {
    const output = renderedOutput(React.createElement('div', null, treeOf({
      name: '<b>x</b>', fieldErrors: { name: { message: '<script>alert(1)</script>' } },
    })));

    expect(output.contains('<script>')).toBe(false);
    expect(output.contains('<b>x')).toBe(false);
  });
});
