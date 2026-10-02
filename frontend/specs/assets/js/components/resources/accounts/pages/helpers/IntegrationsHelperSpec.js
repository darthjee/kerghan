import { renderToStaticMarkup } from 'react-dom/server';
import IntegrationsHelper from '../../../../../../../../assets/js/components/resources/accounts/pages/helpers/IntegrationsHelper.jsx';
import { CLOSED_ADD_FORM } from '../../../../../../../../assets/js/components/resources/accounts/pages/controllers/IntegrationsController.js';
import PatType from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/types/pat.js';
import { findButton, findElements } from '../../../../../../../support/elementTree.js';
import { taggedHandlers } from '../../../../../../../support/taggedHandlers.js';

describe('IntegrationsHelper', () => {
  let handlers;
  const integration = {
    id: 'abc', type: 'pat', label: 'Work', status: 'active', githubLogin: 'octocat', secretHint: 'ghp_…a1b2',
  };
  const buildState = (overrides = {}) => ({
    integrations: [],
    types: [PatType],
    loadState: { loading: false, error: null },
    rowState: new Map(),
    addForm: CLOSED_ADD_FORM,
    ...overrides,
  });
  const render = (overrides) => IntegrationsHelper.render(buildState(overrides), handlers);
  const markupOf = (overrides) => renderToStaticMarkup(render(overrides));

  beforeEach(() => {
    handlers = taggedHandlers();
  });

  it('renders the heading', () => {
    expect(markupOf()).toContain('<h1>Integrations</h1>');
  });

  it('renders the loading state', () => {
    const markup = markupOf({ loadState: { loading: true, error: null } });

    expect(markup).toContain('Loading integrations');
    expect(markup).not.toContain('Add integration');
  });

  it('renders the error state with a retry action', () => {
    const tree = render({ loadState: { loading: false, error: 'GitHub is unavailable' } });

    expect(renderToStaticMarkup(tree)).toContain('GitHub is unavailable');
    expect(findButton(tree, 'Retry').props.onClick).toBe(handlers.onRetry);
  });

  it('renders the empty state with an Add integration action', () => {
    const tree = render();

    expect(renderToStaticMarkup(tree)).toContain('You have no integrations yet.');
    expect(findButton(tree, 'Add integration').props.onClick).toBe(handlers.onOpenAdd);
  });

  it('renders the list with an Add integration action', () => {
    const tree = render({ integrations: [integration] });
    const markup = renderToStaticMarkup(tree);

    expect(markup).not.toContain('You have no integrations yet.');
    expect(markup).toContain('octocat');
    expect(findButton(tree, 'Add integration')).toBeDefined();
  });

  describe('add flow', () => {
    it('opens on the type picker', () => {
      const tree = render({ addForm: { ...CLOSED_ADD_FORM, open: true } });
      const markup = renderToStaticMarkup(tree);

      expect(markup).toContain('Choose a type');
      expect(markup).toContain('Paste a GitHub personal access token (classic or fine-grained).');
      expect(findButton(tree, 'Add integration')).toBeUndefined();
      expect(findButton(tree, 'Cancel').props.onClick).toBe(handlers.onCancelAdd);
    });

    it('renders the PAT form once picked', () => {
      const tree = render({
        addForm: {
          ...CLOSED_ADD_FORM, open: true, type: 'pat', label: 'Work', error: 'Label taken',
        },
      });
      const inputs = findElements(tree, (node) => node.type === 'input');
      const form = findElements(tree, (node) => node.type === 'form')[0];

      expect(renderToStaticMarkup(tree)).toContain('Label taken');
      expect(inputs.map((input) => input.props.type)).toEqual(['text', 'password']);
      expect(inputs[0].props.onChange).toBe(handlers.onAddLabelChange);
      expect(inputs[1].props.onChange).toBe('onAddCredentialChange:token');
      expect(form.props.onSubmit).toBe(handlers.onSubmitAdd);
    });
  });
});
