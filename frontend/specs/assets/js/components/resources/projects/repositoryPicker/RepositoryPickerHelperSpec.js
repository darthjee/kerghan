import RepositoryPickerHelper from '../../../../../../../assets/js/components/resources/projects/repositoryPicker/RepositoryPickerHelper.jsx';
import { findElements } from '../../../../../../support/elementTree.js';

describe('RepositoryPickerHelper', () => {
  const handlers = () => ({
    onClear: jasmine.createSpy('onClear'),
    onPick: jasmine.createSpy('onPick').and.callFake((repository) => () => repository),
    onSearchChange: jasmine.createSpy('onSearchChange'),
  });
  const stateWith = (overrides = {}) => ({
    selected: null, search: '', results: [], noneAdded: false, error: null, ...overrides,
  });
  const texts = (tree) => findElements(tree, () => true).map((node) => node.props?.children).flat().filter((child) => typeof child === 'string');
  const buttons = (tree) => findElements(tree, (node) => node.type === 'button');

  describe('with a chosen repository', () => {
    it('shows owner/name with a Clear button wired to the handler', () => {
      const given = handlers();
      const tree = RepositoryPickerHelper.render(stateWith({ selected: { githubId: 1, fullName: 'a/b' } }), given);

      expect(texts(tree)).toContain('a/b');
      expect(buttons(tree)[0].props.children).toBe('Clear');
      expect(buttons(tree)[0].props.onClick).toBe(given.onClear);
    });

    it('shows no search box', () => {
      const tree = RepositoryPickerHelper.render(stateWith({ selected: { githubId: 1, fullName: 'a/b' } }), handlers());

      expect(findElements(tree, (node) => node.type === 'input')).toEqual([]);
    });
  });

  describe('with no added repository at all', () => {
    it('shows "No repository" and the "Add a repository first" hint linking to Repositories', () => {
      const tree = RepositoryPickerHelper.render(stateWith({ noneAdded: true }), handlers());
      const [link] = findElements(tree, (node) => node.type === 'a');

      expect(texts(tree)).toContain('No repository');
      expect(link.props.href).toBe('#/repositories');
      expect(link.props.children).toBe('Add a repository first');
    });

    it('shows no search box', () => {
      const tree = RepositoryPickerHelper.render(stateWith({ noneAdded: true }), handlers());

      expect(findElements(tree, (node) => node.type === 'input')).toEqual([]);
    });
  });

  describe('searching', () => {
    it('renders a search box with the typed text and the id', () => {
      const given = handlers();
      const tree = RepositoryPickerHelper.render(stateWith({ search: 'ker' }), given, 'my-id');
      const [input] = findElements(tree, (node) => node.type === 'input');

      expect(input.props.value).toBe('ker');
      expect(input.props.id).toBe('my-id');
      expect(input.props.onChange).toBe(given.onSearchChange);
    });

    it('lists the results, handing each repository to onPick', () => {
      const given = handlers();
      const results = [{ githubId: 1, fullName: 'a/b' }, { githubId: 2, fullName: 'c/d' }];
      const tree = RepositoryPickerHelper.render(stateWith({ results }), given);

      expect(buttons(tree).map((button) => button.props.children)).toEqual(['a/b', 'c/d']);
      expect(given.onPick).toHaveBeenCalledWith(results[0]);
      expect(given.onPick).toHaveBeenCalledWith(results[1]);
    });

    it('says nothing matches, echoing the search as text', () => {
      const tree = RepositoryPickerHelper.render(stateWith({ search: 'zz' }), handlers());

      expect(texts(tree)).toContain('No added repositories match "zz".');
    });

    it('shows nothing under the box before the first results', () => {
      const tree = RepositoryPickerHelper.render(stateWith(), handlers());

      expect(buttons(tree)).toEqual([]);
      expect(findElements(tree, (node) => node.type === 'p')).toEqual([]);
    });

    it('shows a load error', () => {
      const tree = RepositoryPickerHelper.render(stateWith({ error: 'Boom' }), handlers());
      const [alert] = findElements(tree, (node) => node.props?.role === 'alert');

      expect(alert.props.children).toBe('Boom');
    });
  });
});
