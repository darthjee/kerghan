import ProjectsToolbarHelper from '../../../../../../../../../assets/js/components/resources/projects/pages/list/helpers/ProjectsToolbarHelper.jsx';
import { findElements } from '../../../../../../../../support/elementTree.js';

describe('ProjectsToolbarHelper', () => {
  const render = (search = '', handlers = { onSearchChange: jasmine.createSpy('onSearchChange') }) => (
    ProjectsToolbarHelper.render({ page: 1, search }, handlers)
  );

  it('renders a search box showing the query and wired to the handler', () => {
    const onSearchChange = jasmine.createSpy('onSearchChange');
    const [input] = findElements(render('ker', { onSearchChange }), (node) => node.type === 'input');

    expect(input.props.value).toBe('ker');
    expect(input.props.onChange).toBe(onSearchChange);
    expect(input.props.type).toBe('search');
    expect(input.props.maxLength).toBe(100);
  });

  it('renders a "New project" link to the creation form', () => {
    const [link] = findElements(render(), (node) => node.type === 'a');

    expect(link.props.href).toBe('#/projects/new');
    expect(link.props.children).toBe('New project');
  });
});
