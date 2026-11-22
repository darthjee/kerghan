import IssuesToolbarHelper from '../../../../../../../../assets/js/components/resources/issues/list/helpers/IssuesToolbarHelper.jsx';
import { findElements } from '../../../../../../../support/elementTree.js';
import { PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';

describe('IssuesToolbarHelper', () => {
  const handlers = {
    onSearchChange: jasmine.createSpy('onSearchChange'),
    onStateChange: jasmine.createSpy('onStateChange'),
  };
  const render = (query = { state: 'open', search: '' }) => IssuesToolbarHelper.render(PROJECT_ID, query, handlers);

  it('renders a state select with Open, Closed and All, showing the query state', () => {
    const [select] = findElements(render({ state: 'closed', search: '' }), (node) => node.type === 'select');
    const options = findElements(select, (node) => node.type === 'option');

    expect(select.props.value).toBe('closed');
    expect(select.props.onChange).toBe(handlers.onStateChange);
    expect(options.map((option) => option.props.children)).toEqual(['Open', 'Closed', 'All']);
    expect(options.map((option) => option.props.value)).toEqual(['open', 'closed', 'all']);
  });

  it('renders a title search box showing the query and wired to the handler', () => {
    const [input] = findElements(render({ state: 'open', search: 'log' }), (node) => node.type === 'input');

    expect(input.props.value).toBe('log');
    expect(input.props.onChange).toBe(handlers.onSearchChange);
    expect(input.props.type).toBe('search');
    expect(input.props.maxLength).toBe(100);
  });

  it('renders a "New issue" link to the creation form', () => {
    const [link] = findElements(render(), (node) => node.type === 'a');

    expect(link.props.href).toBe(`#/projects/${PROJECT_ID}/issues/new`);
    expect(link.props.children).toBe('New issue');
  });
});
