import { useEffect, useMemo, useState } from 'react';
import BulkSelectionController, { INITIAL_BULK } from './controllers/BulkSelectionController.js';
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
 * @param {{current: (IssuesController|null)}} [listRef] - Ref the page uses to re-read the
 *   list (T3 and window focus); it holds the controller while the list is mounted.
 * @returns {Function} Effect callback, returning its cleanup.
 */
export function buildStartEffect(controller, listRef) {
  return () => {
    const onHashChange = () => controller.handleHashChange();

    controller.start();
    window.addEventListener('hashchange', onHashChange);

    if (listRef) {
      listRef.current = controller;
    }

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      controller.dispose();

      if (listRef) {
        listRef.current = null;
      }
    };
  };
}

/**
 * A project's issue list: a state filter and a title search, with paging held in the hash
 * query. It sits below the project page's header.
 *
 * @param {{projectId: string, canImport: (boolean|undefined), onImport: (Function|undefined),
 *   listRef: (object|undefined)}} props - The project's uuid, whether the project has a
 *   repository (the empty states then offer "Import from GitHub"), the callback opening the
 *   import modal, and the ref receiving the list's controller so the page can re-read it.
 * @returns {React.ReactElement} The rendered list.
 */
export default function IssueList({
  projectId, canImport = false, onImport, listRef,
}) {
  const [listing, setListing] = useState(INITIAL_LISTING);
  const [query, setQuery] = useState(INITIAL_QUERY);
  const [loadState, setLoadState] = useState(INITIAL_LOAD_STATE);

  const [bulk, setBulk] = useState(INITIAL_BULK);

  const { controller, bulkController } = useMemo(() => {
    const bulkSelection = new BulkSelectionController(
      { setBulk }, projectId, { reload: () => list.load() },
    );
    const list = new IssuesController(
      {
        setListing, setQuery, setLoadState, clearSelection: () => bulkSelection.clear(),
      },
      projectId,
    );

    return { controller: list, bulkController: bulkSelection };
  }, [projectId]);

  useEffect(() => buildStartEffect(controller, listRef)(), [controller, listRef]);
  useEffect(() => () => bulkController.dispose(), [bulkController]);

  return IssuesHelper.render(
    {
      projectId, listing, query, loadState, canImport, bulk,
    },
    { ...IssuesHandlers.build(controller), onImport },
  );
}
