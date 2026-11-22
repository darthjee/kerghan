import { useEffect, useMemo, useState } from 'react';
import ProjectsController from './list/controllers/ProjectsController.js';
import ProjectsHandlers from './list/helpers/ProjectsHandlers.js';
import ProjectsHelper from './list/helpers/ProjectsHelper.jsx';

const INITIAL_LISTING = { projects: [], pagination: { page: 1, perPage: 50, total: 0, totalPages: 0 } };
const INITIAL_QUERY = { page: 1, search: '' };
const INITIAL_LOAD_STATE = { loading: true, error: null };

/**
 * Build the mount-time effect: starts the controller (reading the hash query and loading the
 * first page), re-reads the query on `hashchange` (Back and Forward), and returns a cleanup
 * disposing the controller on unmount.
 *
 * @param {ProjectsController} controller - The page's controller.
 * @returns {Function} Effect callback, returning its cleanup.
 */
export function buildStartEffect(controller) {
  return () => {
    const onHashChange = () => controller.handleHashChange();

    controller.start();
    window.addEventListener('hashchange', onHashChange);

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      controller.dispose();
    };
  };
}

/**
 * Project list page (`#/projects`): the caller's projects, with a name search and paging held
 * in the hash query.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function Projects() {
  const [listing, setListing] = useState(INITIAL_LISTING);
  const [query, setQuery] = useState(INITIAL_QUERY);
  const [loadState, setLoadState] = useState(INITIAL_LOAD_STATE);
  const [notice, setNotice] = useState(null);

  const controller = useMemo(
    () => new ProjectsController({
      setListing, setQuery, setLoadState, setNotice,
    }),
    [],
  );

  useEffect(() => buildStartEffect(controller)(), [controller]);

  return ProjectsHelper.render(
    {
      listing, query, loadState, notice,
    },
    ProjectsHandlers.build(controller),
  );
}
