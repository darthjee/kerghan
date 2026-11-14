import RepositoriesHandlers from '../../../../../../../../assets/js/components/resources/repositories/pages/repositories/RepositoriesHandlers.js';

describe('RepositoriesHandlers', () => {
  let controller;
  let handlers;

  beforeEach(() => {
    controller = jasmine.createSpyObj('controller', [
      'changeFilter', 'changeSearch', 'changePage', 'refresh', 'add', 'dismiss', 'retry',
    ]);
    handlers = RepositoriesHandlers.build(controller);
  });

  it('changes the filter from the event', () => {
    handlers.onFilterChange({ target: { value: 'added' } });

    expect(controller.changeFilter).toHaveBeenCalledWith('added');
  });

  it('changes the search from the event', () => {
    handlers.onSearchChange({ target: { value: 'kerg' } });

    expect(controller.changeSearch).toHaveBeenCalledWith('kerg');
  });

  it('changes the page', () => {
    handlers.onPageChange(3)();

    expect(controller.changePage).toHaveBeenCalledWith(3);
  });

  it('refreshes', () => {
    handlers.onRefresh();

    expect(controller.refresh).toHaveBeenCalled();
  });

  it('adds a repository', () => {
    handlers.onAdd(7)();

    expect(controller.add).toHaveBeenCalledWith(7);
  });

  it('dismisses a source', () => {
    const source = { kind: 'handle' };

    handlers.onDismiss(source)();

    expect(controller.dismiss).toHaveBeenCalledWith(source);
  });

  it('retries', () => {
    handlers.onRetry();

    expect(controller.retry).toHaveBeenCalled();
  });
});
