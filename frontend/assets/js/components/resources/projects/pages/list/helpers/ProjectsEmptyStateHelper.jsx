/**
 * Rendering helper for the project list's empty states.
 */
const ProjectsEmptyStateHelper = {
  /**
   * Render the empty state matching why there are no rows.
   *
   * @param {{search: string}} query - The current query.
   * @returns {React.ReactElement} The no-match message for a search, or the no-projects state
   *   with its Repositories hint and "New project" action.
   */
  render(query) {
    if (query.search !== '') {
      return <p>{`No projects match "${query.search}".`}</p>;
    }

    return (
      <div className="text-center my-5">
        <p className="mb-1">You have no projects yet.</p>
        <p className="text-muted">
          You can also create one from an added repository on <a href="#/repositories">Repositories</a>.
        </p>
        <a className="btn btn-primary" href="#/projects/new">New project</a>
      </div>
    );
  },
};

export default ProjectsEmptyStateHelper;
