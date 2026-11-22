import IssuesHandlers from '../../../../../../../../assets/js/components/resources/issues/list/helpers/IssuesHandlers.js';

describe('IssuesHandlers', () => {
  let controller;
  let handlers;

  beforeEach(() => {
    controller = jasmine.createSpyObj('controller', ['changeSearch', 'changeState', 'changePage', 'retry']);
    handlers = IssuesHandlers.build(controller);
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
});
