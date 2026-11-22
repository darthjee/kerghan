import { useEffect, useMemo, useState } from 'react';
import IssuesController from './controllers/IssuesController.js';
import IssuesHandlers from './helpers/IssuesHandlers.js';
import IssuesHelper from './helpers/IssuesHelper.jsx';

const INITIAL_LISTING = { issues: [], pagination: { page: 1, perPage: 50, total: 0, totalPages: 0 } };
const INITIAL_QUERY = { state: 'open', page: 1, search: '' };
const INITIAL_LOAD_STATE = { loading: true, error: null };

/**
 * Build the mount-time effect: starts the controller (reading the hash query and loading the
 * first page), re-reads the query on `hashchange` (Back and Forward), and returns a cleanup
 * disposing the controller on unmount.
 *
 * @param {IssuesController} controller - The list's controller.
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
 * A project's issue list: a state filter and a title search, with paging held in the hash
 * query. It sits below the project page's header.
 *
 * @param {{projectId: string}} props - The project's uuid.
 * @returns {React.ReactElement} The rendered list.
 */
export default function IssueList({ projectId }) {
  const [listing, setListing] = useState(INITIAL_LISTING);
  const [query, setQuery] = useState(INITIAL_QUERY);
  const [loadState, setLoadState] = useState(INITIAL_LOAD_STATE);

  const controller = useMemo(
    () => new IssuesController({ setListing, setQuery, setLoadState }, projectId),
    [projectId],
  );

  useEffect(() => buildStartEffect(controller)(), [controller]);

  return IssuesHelper.render(
    {
      projectId, listing, query, loadState,
    },
    IssuesHandlers.build(controller),
  );
}
