import IssuesBulkBarHelper from '../../../../../../../../assets/js/components/resources/issues/list/helpers/IssuesBulkBarHelper.jsx';
import { INITIAL_BULK } from '../../../../../../../../assets/js/components/resources/issues/list/controllers/BulkSelectionController.js';
import { findElements } from '../../../../../../../support/elementTree.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('IssuesBulkBarHelper', () => {
  const handlers = {
    onBulkClose: jasmine.createSpy('onBulkClose'),
    onBulkReopen: jasmine.createSpy('onBulkReopen'),
  };
  const bulkWith = (overrides) => ({ ...INITIAL_BULK, selected: ['a', 'b'], ...overrides });
  const treeOf = (overrides) => IssuesBulkBarHelper.render(bulkWith(overrides), handlers);
  const buttons = (overrides) => findElements(treeOf(overrides), (node) => node.type === 'button');

  it('renders nothing while no row is selected', () => {
    expect(IssuesBulkBarHelper.render(bulkWith({ selected: [] }), handlers)).toBeNull();
  });

  it('shows the selected count and both buttons', () => {
    const tree = treeOf();
    const output = renderedOutput(tree);

    expect(output.contains('2 selected')).toBe(true);
    expect(output.containsElement('button', 'Close selected')).toBe(true);
    expect(output.containsElement('button', 'Reopen selected')).toBe(true);
    expect(buttons().every((button) => button.props.className.includes('btn-outline-secondary'))).toBe(true);
  });

  it('wires the buttons to their handlers', () => {
    const [close, reopen] = buttons();

    close.props.onClick();
    reopen.props.onClick();

    expect(handlers.onBulkClose).toHaveBeenCalled();
    expect(handlers.onBulkReopen).toHaveBeenCalled();
  });

  it('enables both buttons when idle', () => {
    expect(buttons().map((button) => button.props.disabled)).toEqual([false, false]);
  });

  describe('while a call is in flight (U2)', () => {
    it('disables both buttons and spins on the clicked one only', () => {
      const bulk = { inFlight: true, target: 'closed' };

      expect(buttons(bulk).map((button) => button.props.disabled)).toEqual([true, true]);
      const [close, reopen] = buttons(bulk);

      expect(renderedOutput(close).contains('spinner-border')).toBe(true);
      expect(renderedOutput(reopen).contains('spinner-border')).toBe(false);
    });

    it('spins on Reopen when reopening', () => {
      const [close, reopen] = buttons({ inFlight: true, target: 'open' });

      expect(renderedOutput(close).contains('spinner-border')).toBe(false);
      expect(renderedOutput(reopen).contains('spinner-border')).toBe(true);
    });
  });

  describe('during the rate-limit countdown', () => {
    const countdown = { active: true, secondsLeft: 7, label: 'Try again in 7 s' };

    it('disables both buttons and shows the countdown label on both', () => {
      const output = renderedOutput(treeOf({ countdown }));

      expect(buttons({ countdown }).map((button) => button.props.disabled)).toEqual([true, true]);
      expect(output.containsElement('button', 'Try again in 7 s')).toBe(true);
      expect(output.contains('Close selected')).toBe(false);
    });
  });

  describe('errors', () => {
    it('shows no error by default', () => {
      expect(renderedOutput(treeOf()).contains('role="alert"')).toBe(false);
    });

    it('shows the described error inline in the bar, as text (S1)', () => {
      const output = renderedOutput(treeOf({ error: { message: '<b>Slow down</b>' } }));

      expect(output.contains('role="alert"')).toBe(true);
      expect(output.contains('&lt;b&gt;Slow down&lt;/b&gt;')).toBe(true);
    });
  });
});
