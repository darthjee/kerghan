import IssuesHandlers from '../../../../../../../../assets/js/components/resources/issues/list/helpers/IssuesHandlers.js';

describe('IssuesHandlers', () => {
  let controller;
  let bulkController;
  let handlers;

  beforeEach(() => {
    controller = jasmine.createSpyObj('controller', ['changeSearch', 'changeState', 'changePage', 'retry']);
    bulkController = jasmine.createSpyObj('bulkController', ['toggle', 'toggleAll', 'apply', 'dismissNotice']);
    handlers = IssuesHandlers.build(controller, bulkController);
  });

  it('sends the typed search to the controller', () => {
    handlers.onSearchChange({ target: { value: 'log' } });

    expect(controller.changeSearch).toHaveBeenCalledWith('log');
  });

  it('sends the chosen state to the controller', () => {
    handlers.onStateChange({ target: { value: 'closed' } });

    expect(controller.changeState).toHaveBeenCalledWith('closed');
  });

  it('builds a page-change handler per page', () => {
    handlers.onPageChange(3)();

    expect(controller.changePage).toHaveBeenCalledWith(3);
  });

  it('retries through the controller', () => {
    handlers.onRetry();

    expect(controller.retry).toHaveBeenCalled();
  });

  it('toggles one issue and the whole page through the bulk controller', () => {
    handlers.onToggle('a');
    handlers.onToggleAll(['a', 'b']);

    expect(bulkController.toggle).toHaveBeenCalledWith('a');
    expect(bulkController.toggleAll).toHaveBeenCalledWith(['a', 'b']);
  });

  it('applies the closed and open states', () => {
    handlers.onBulkClose();
    handlers.onBulkReopen();

    expect(bulkController.apply.calls.allArgs()).toEqual([['closed'], ['open']]);
  });

  it('dismisses the notice', () => {
    handlers.onDismissNotice();

    expect(bulkController.dismissNotice).toHaveBeenCalled();
  });
});
