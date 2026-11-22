import IssueBody from '../../../../../../../../assets/js/components/resources/issues/body/IssueBody.jsx';
import IssueFieldsHelper from '../../../../../../../../assets/js/components/resources/issues/pages/form/IssueFieldsHelper.jsx';
import { findElements } from '../../../../../../../support/elementTree.js';

describe('IssueFieldsHelper', () => {
  const handlers = {
    onTitleChange: jasmine.createSpy('onTitleChange'),
    onBodyChange: jasmine.createSpy('onBodyChange'),
    onStateChange: jasmine.createSpy('onStateChange'),
    onTabChange: jasmine.createSpy('onTabChange'),
  };
  const state = (overrides) => ({
    title: 'Fix', body: '# Steps', state: 'open', tab: 'write', fieldErrors: {}, ...overrides,
  });

  describe('.renderTitle', () => {
    it('renders a text input with the title, wired to the handler', () => {
      const [input] = findElements(IssueFieldsHelper.renderTitle(state(), handlers), (node) => node.type === 'input');

      expect(input.props.value).toBe('Fix');
      expect(input.props.onChange).toBe(handlers.onTitleChange);
    });

    it('shows the title error', () => {
      const tree = IssueFieldsHelper.renderTitle(state({ fieldErrors: { title: { message: 'Title is required' } } }), handlers);
      const [input] = findElements(tree, (node) => node.type === 'input');

      expect(input.props.className).toContain('is-invalid');
      expect(findElements(tree, (node) => node.props?.error?.message === 'Title is required').length).toBe(1);
    });
  });

  describe('.renderBody', () => {
    it('on Write, renders a plain textarea with the body as typed, and no preview', () => {
      const tree = IssueFieldsHelper.renderBody(state({ body: '  spaced  ' }), handlers);
      const [textarea] = findElements(tree, (node) => node.type === 'textarea');

      expect(textarea.props.value).toBe('  spaced  ');
      expect(textarea.props.onChange).toBe(handlers.onBodyChange);
      expect(findElements(tree, (node) => node.type === IssueBody)).toEqual([]);
    });

    it('P3: on Preview, mounts IssueBody with the body and no textarea', () => {
      const tree = IssueFieldsHelper.renderBody(state({ tab: 'preview' }), handlers);
      const [preview] = findElements(tree, (node) => node.type === IssueBody);

      expect(preview.props.body).toBe('# Steps');
      expect(findElements(tree, (node) => node.type === 'textarea')).toEqual([]);
    });

    it('renders the Write and Preview tabs, the selected one marked', () => {
      const tabs = findElements(IssueFieldsHelper.renderBody(state({ tab: 'preview' }), handlers), (node) => node.props?.role === 'tab');

      expect(tabs.map((tab) => tab.props.children)).toEqual(['Write', 'Preview']);
      expect(tabs.map((tab) => tab.props['aria-selected'])).toEqual([false, true]);
    });

    it('selects a tab through the handler', () => {
      const [, preview] = findElements(IssueFieldsHelper.renderBody(state(), handlers), (node) => node.props?.role === 'tab');

      preview.props.onClick();

      expect(handlers.onTabChange).toHaveBeenCalledWith('preview');
    });

    it('shows the body error', () => {
      const tree = IssueFieldsHelper.renderBody(state({ fieldErrors: { body: { message: 'Too long' } } }), handlers);

      expect(findElements(tree, (node) => node.props?.error?.message === 'Too long').length).toBe(1);
    });
  });

  describe('.renderState', () => {
    it('renders an Open and Closed select showing the state', () => {
      const tree = IssueFieldsHelper.renderState(state({ state: 'closed' }), handlers);
      const [select] = findElements(tree, (node) => node.type === 'select');
      const options = findElements(tree, (node) => node.type === 'option');

      expect(select.props.value).toBe('closed');
      expect(select.props.onChange).toBe(handlers.onStateChange);
      expect(options.map((option) => option.props.children)).toEqual(['Open', 'Closed']);
    });
  });
});
