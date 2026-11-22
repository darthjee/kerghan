import Modal from 'react-bootstrap/cjs/Modal.js';
import ConfirmModalHelper from '../../../../../../../assets/js/components/common/confirmModal/helpers/ConfirmModalHelper.jsx';
import { findElements } from '../../../../../../support/elementTree.js';

describe('ConfirmModalHelper', () => {
  const baseState = {
    title: 'Delete project',
    message: 'This cannot be undone.',
    confirmLabel: 'Delete project',
    danger: true,
    typeToConfirm: undefined,
    typed: '',
    pending: false,
    error: null,
  };
  const buildHandlers = () => ({
    onCancel: jasmine.createSpy('onCancel'),
    onConfirm: jasmine.createSpy('onConfirm'),
    onTypedChange: jasmine.createSpy('onTypedChange'),
  });

  const buttons = (tree) => findElements(tree, (node) => node.type === 'button');
  const textOf = (button) => [button.props.children].flat().filter((child) => typeof child === 'string').join('');
  const render = (overrides = {}, handlers = buildHandlers()) => (
    ConfirmModalHelper.render({ ...baseState, ...overrides }, handlers)
  );

  it('renders a shown react-bootstrap Modal', () => {
    const element = render();

    expect(element.type).toBe(Modal);
    expect(element.props.show).toBe(true);
  });

  it('shows the title and the message', () => {
    const tree = render();

    expect(findElements(tree, (node) => node.type === Modal.Title)[0].props.children).toBe('Delete project');
    expect(findElements(tree, (node) => node.type === 'p')[0].props.children).toBe('This cannot be undone.');
  });

  it('puts Cancel first, with the initial focus, and the named confirm button on the right', () => {
    const [cancel, confirm] = buttons(render());

    expect(textOf(cancel)).toBe('Cancel');
    expect(cancel.props.autoFocus).toBe(true);
    expect(textOf(confirm)).toBe('Delete project');
    expect(confirm.props.autoFocus).toBeUndefined();
  });

  it('makes the confirm button red for a destructive action only', () => {
    expect(buttons(render({ danger: true }))[1].props.className).toContain('btn-danger');
    expect(buttons(render({ danger: false }))[1].props.className).not.toContain('btn-danger');
  });

  it('wires Cancel, Confirm and the modal close to the handlers', () => {
    const handlers = buildHandlers();
    const element = render({}, handlers);
    const [cancel, confirm] = buttons(element);

    expect(cancel.props.onClick).toBe(handlers.onCancel);
    expect(confirm.props.onClick).toBe(handlers.onConfirm);
    expect(element.props.onHide).toBe(handlers.onCancel);
  });

  describe('typed confirmation', () => {
    const inputs = (tree) => findElements(tree, (node) => node.type === 'input');

    it('shows no input when no text is required', () => {
      expect(inputs(render())).toEqual([]);
      expect(buttons(render())[1].props.disabled).toBe(false);
    });

    it('shows the input and disables Confirm until the text matches', () => {
      const tree = render({ typeToConfirm: 'Kerghan', typed: 'Kerg' });

      expect(inputs(tree).length).toBe(1);
      expect(inputs(tree)[0].props.value).toBe('Kerg');
      expect(buttons(tree)[1].props.disabled).toBe(true);
    });

    it('enables Confirm on a trimmed, exact, case-sensitive match', () => {
      expect(buttons(render({ typeToConfirm: 'Kerghan', typed: ' Kerghan ' }))[1].props.disabled).toBe(false);
      expect(buttons(render({ typeToConfirm: 'Kerghan', typed: 'kerghan' }))[1].props.disabled).toBe(true);
    });

    it('names the text to type', () => {
      const label = findElements(render({ typeToConfirm: 'Kerghan' }), (node) => node.type === 'label')[0];

      expect(label.props.children).toBe('Type "Kerghan" to confirm');
    });
  });

  describe('in flight', () => {
    it('disables both buttons and shows a spinner on Confirm', () => {
      const tree = render({ pending: true });
      const [cancel, confirm] = buttons(tree);
      const spinners = findElements(confirm, (node) => String(node.props?.className).includes('spinner-border'));

      expect(cancel.props.disabled).toBe(true);
      expect(confirm.props.disabled).toBe(true);
      expect(spinners.length).toBe(1);
    });

    it('does not close the modal from the backdrop or the close button', () => {
      const element = render({ pending: true });

      expect(element.props.onHide).toBeUndefined();
      expect(element.props.backdrop).toBe('static');
    });

    it('shows no spinner otherwise', () => {
      const spinners = findElements(render(), (node) => String(node.props?.className).includes('spinner-border'));

      expect(spinners).toEqual([]);
    });
  });

  describe('error', () => {
    it('shows the message in an alert inside the modal', () => {
      const alerts = findElements(render({ error: 'Boom' }), (node) => node.props?.role === 'alert');

      expect(alerts.length).toBe(1);
      expect(alerts[0].props.children).toBe('Boom');
    });

    it('shows no alert without an error', () => {
      expect(findElements(render(), (node) => node.props?.role === 'alert')).toEqual([]);
    });
  });
});
