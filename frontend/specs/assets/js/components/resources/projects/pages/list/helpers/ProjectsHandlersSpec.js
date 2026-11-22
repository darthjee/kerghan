import ProjectsHandlers from '../../../../../../../../../assets/js/components/resources/projects/pages/list/helpers/ProjectsHandlers.js';

describe('ProjectsHandlers', () => {
  let controller;
  let handlers;

  beforeEach(() => {
    controller = jasmine.createSpyObj('controller', ['changeSearch', 'changePage', 'retry']);
    handlers = ProjectsHandlers.build(controller);
  });

  it('sends the typed search to the controller', () => {
    handlers.onSearchChange({ target: { value: 'ker' } });

    expect(controller.changeSearch).toHaveBeenCalledWith('ker');
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
