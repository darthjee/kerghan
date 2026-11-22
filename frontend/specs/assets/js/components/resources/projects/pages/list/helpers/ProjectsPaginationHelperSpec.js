import RepositoriesPaginationHelper from '../../../../../../../../../assets/js/components/resources/repositories/pages/helpers/RepositoriesPaginationHelper.jsx';
import ProjectsPaginationHelper from '../../../../../../../../../assets/js/components/resources/projects/pages/list/helpers/ProjectsPaginationHelper.jsx';

describe('ProjectsPaginationHelper', () => {
  it('delegates to the shared pagination controls', () => {
    const marker = {};
    const pagination = { page: 2, totalPages: 4 };
    const handlers = { onPageChange: () => undefined };

    spyOn(RepositoriesPaginationHelper, 'render').and.returnValue(marker);

    expect(ProjectsPaginationHelper.render(pagination, handlers)).toBe(marker);
    expect(RepositoriesPaginationHelper.render).toHaveBeenCalledOnceWith(pagination, handlers);
  });

  it('renders nothing for a single page', () => {
    expect(ProjectsPaginationHelper.render({ page: 1, totalPages: 1 }, {})).toBeNull();
  });
});
