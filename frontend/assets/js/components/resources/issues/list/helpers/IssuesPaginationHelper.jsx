import RepositoriesPaginationHelper from '../../../repositories/pages/helpers/RepositoriesPaginationHelper.jsx';

/**
 * Rendering helper for the issue list's pagination controls; the same controls as the
 * Repositories listing, reused through its helper.
 */
const IssuesPaginationHelper = {
  /**
   * Render the pagination controls.
   *
   * @param {{page: number, totalPages: number}} pagination - The listing's pagination.
   * @param {{onPageChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement|null} The controls, or `null` for a single page.
   */
  render(pagination, handlers) {
    return RepositoriesPaginationHelper.render(pagination, handlers);
  },
};

export default IssuesPaginationHelper;
