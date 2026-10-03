import { renderToStaticMarkup } from 'react-dom/server';
import GithubAppSelection from '../../../../../../../../assets/js/components/resources/accounts/pages/helpers/GithubAppSelection.jsx';
import { findButton, findElements } from '../../../../../../../support/elementTree.js';

describe('GithubAppSelection', () => {
  const SELECT_STATE = 'SELECTcanary0000';
  const installations = [
    { installationId: 12345678, accountLogin: 'acme', accountType: 'Organization' },
    { installationId: 23456789, accountLogin: 'octocat', accountType: 'User' },
  ];
  let onSelect;
  let onCancel;

  const render = (selection) => GithubAppSelection({ selection, onSelect, onCancel });

  beforeEach(() => {
    onSelect = jasmine.createSpy('onSelect').and.callFake((id) => `select-${id}`);
    onCancel = jasmine.createSpy('onCancel');
  });

  it('renders nothing without a selection', () => {
    expect(render(null)).toBeNull();
  });

  it('lists each installation with its account marker and a choose button', () => {
    const tree = render({ state: SELECT_STATE, installations });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain('acme');
    expect(markup).toContain('Organization');
    expect(markup).toContain('octocat');
    expect(markup).toContain('User');
    expect(findButton(tree, 'Choose acme').props.onClick).toBe('select-12345678');
    expect(findButton(tree, 'Choose octocat').props.onClick).toBe('select-23456789');
  });

  it('offers a cancel that drops the selection', () => {
    expect(findButton(render({ state: SELECT_STATE, installations }), 'Cancel').props.onClick).toBe(onCancel);
  });

  it('never renders the selection state', () => {
    expect(renderToStaticMarkup(render({ state: SELECT_STATE, installations }))).not.toContain(SELECT_STATE);
  });

  it('does not mention the limit under 100 installations', () => {
    expect(renderToStaticMarkup(render({ state: SELECT_STATE, installations })))
      .not.toContain('Only the first 100 installations are shown.');
  });

  it('says only the first 100 are shown when exactly 100 arrive', () => {
    const hundred = Array.from({ length: 100 }, (_, index) => ({
      installationId: index + 1, accountLogin: `account-${index}`, accountType: 'User',
    }));
    const tree = render({ state: SELECT_STATE, installations: hundred });

    expect(renderToStaticMarkup(tree)).toContain('Only the first 100 installations are shown.');
    expect(findElements(tree, (node) => node.type === 'li').length).toBe(100);
  });

  it('falls back to the raw account type and an empty list', () => {
    expect(renderToStaticMarkup(render({
      state: SELECT_STATE, installations: [{ installationId: 1, accountLogin: 'bot', accountType: 'Bot' }],
    }))).toContain('Bot');
    expect(renderToStaticMarkup(render({ state: SELECT_STATE }))).toContain('Choose a GitHub App installation');
  });
});
