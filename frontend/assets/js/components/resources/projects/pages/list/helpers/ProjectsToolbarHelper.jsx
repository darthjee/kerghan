/**
 * Rendering helper for the project list's toolbar: the name search and "New project".
 */
const ProjectsToolbarHelper = {
  /**
   * Render the toolbar.
   *
   * @param {{search: string}} query - The current query.
   * @param {{onSearchChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The toolbar.
   */
  render(query, handlers) {
    return (
      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <input
          type="search"
          className="form-control w-auto"
          aria-label="Search projects"
          placeholder="Search by name"
          maxLength={100}
          value={query.search}
          onChange={handlers.onSearchChange}
        />
        <a className="btn btn-primary ms-auto" href="#/projects/new">New project</a>
      </div>
    );
  },
};

export default ProjectsToolbarHelper;
