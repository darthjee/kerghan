import Modal from 'react-bootstrap/cjs/Modal.js';
import IssueNumberModalHelper from '../../../../../../../../assets/js/components/resources/issues/link/modals/IssueNumberModalHelper.jsx';
import { findElements } from '../../../../../../../support/elementTree.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';
import DescribedError from '../../../../../../../../assets/js/components/resources/projects/DescribedError.jsx';

describe('IssueNumberModalHelper', () => {
  const idle = { active: false, secondsLeft: 0, label: null };
  const base = {
    title: 'Link to a GitHub issue', submitLabel: 'Link', value: '12', pending: false, error: null, countdown: idle,
  };
  let handlers;

  beforeEach(() => {
    handlers = jasmine.createSpyObj('handlers', ['onChange', 'onSubmit', 'onCancel']);
  });

  const render = (overrides) => IssueNumberModalHelper.render({ ...base, ...overrides }, handlers);
  const find = (tree, predicate) => findElements(tree, predicate);

  const textOf = (button) => [button.props.children].flat().filter((child) => typeof child === 'string').join('');

  it('shows the title, the typed value, Cancel first and the submit on its right', () => {
    const tree = render();
    const [input] = find(tree, (node) => node.type === 'input');
    const [cancel, submit] = find(tree, (node) => node.type === 'button');

    expect(find(tree, (node) => node.type === Modal.Title)[0].props.children).toBe('Link to a GitHub issue');
    expect(input.props.value).toBe('12');
    expect(textOf(cancel)).toBe('Cancel');
    expect(textOf(submit)).toBe('Link');
    expect(submit.props.type).toBe('submit');
  });

  it('wires the form, the input and Cancel', () => {
    const tree = render();
    const [form] = find(tree, (node) => node.type === 'form');
    const [input] = find(tree, (node) => node.type === 'input');
    const [cancel] = find(tree, (node) => node.type === 'button' && node.props.type === 'button');

    expect(form.props.onSubmit).toBe(handlers.onSubmit);
    expect(input.props.onChange).toBe(handlers.onChange);
    expect(cancel.props.onClick).toBe(handlers.onCancel);
  });

  it('shows the error inside, through DescribedError, which renders text (S1)', () => {
    const error = { message: '<b>x</b>', link: { href: '#/x', text: 'Open' } };
    const [described] = find(render({ error }), (node) => node.type === DescribedError);
    const output = renderedOutput(described);

    expect(described.props.error).toBe(error);
    expect(output.contains('&lt;b&gt;x&lt;/b&gt;')).toBe(true);
    expect(output.contains('<b>')).toBe(false);
    expect(output.containsElement('a', 'Open')).toBe(true);
  });

  it('U2: disables the input and both buttons and shows a spinner in flight', () => {
    const tree = render({ pending: true });
    const buttons = find(tree, (node) => node.type === 'button');
    const [input] = find(tree, (node) => node.type === 'input');

    expect(buttons.every((button) => button.props.disabled)).toBeTrue();
    expect(input.props.disabled).toBeTrue();
    expect(renderedOutput(buttons[1].props.children[0]).contains('spinner-border')).toBe(true);
    expect(find(tree, (node) => node.type === Modal)[0].props.onHide).toBeUndefined();
  });

  it('reads "Try again in N s" and disables submit while a rate limit runs, with Cancel enabled', () => {
    const tree = render({ countdown: { active: true, secondsLeft: 6, label: 'Try again in 6 s' } });
    const [cancel, submit] = find(tree, (node) => node.type === 'button');

    expect(textOf(submit)).toBe('Try again in 6 s');
    expect(submit.props.disabled).toBeTrue();
    expect(cancel.props.disabled).toBeFalse();
  });

  it('enables submit again when the countdown ended', () => {
    const [, submit] = find(render(), (node) => node.type === 'button');

    expect(submit.props.disabled).toBeFalse();
  });
});
