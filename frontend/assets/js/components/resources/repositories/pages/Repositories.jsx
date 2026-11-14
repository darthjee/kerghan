import { useEffect, useMemo, useState } from 'react';
import RepositoriesController, { INITIAL_QUERY } from './controllers/RepositoriesController.js';
import RepositoriesHelper from './helpers/RepositoriesHelper.jsx';
import RepositoriesHandlers from './repositories/RepositoriesHandlers.js';

const INITIAL_LISTING = { repositories: [], pagination: { page: 1, perPage: 50, total: 0, totalPages: 0 } };
const INITIAL_LOAD_STATE = { loading: true, error: null };

/**
 * Build the mount-time effect: triggers `controller.load()` once, with no login check of its
 * own (a logged-out `401` is handled by `ApiClient`'s refresh/login-modal flow), and returns a
 * cleanup disposing the controller's timers and Add state on unmount.
 *
 * @param {RepositoriesController} controller - The page's controller.
 * @returns {Function} Effect callback, returning its cleanup.
 */
export function buildLoadEffect(controller) {
  return () => {
    controller.load();
    return () => controller.dispose();
  };
}

/**
 * Repositories page (`#/repositories`): lists the caller's repositories, keeps them in sync
 * with GitHub through the backend, and lets the user add them.
 *
 * @returns {React.ReactElement} The rendered Repositories page.
 */
export default function Repositories() {
  const [listing, setListing] = useState(INITIAL_LISTING);
  const [sync, setSync] = useState(null);
  const [query, setQuery] = useState(INITIAL_QUERY);
  const [loadState, setLoadState] = useState(INITIAL_LOAD_STATE);
  const [addState, setAddState] = useState(new Map());
  const [dismissed, setDismissed] = useState(new Set());
  const [refreshNotice, setRefreshNotice] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [cooldownUntil, setCooldownUntil] = useState(null);

  const controller = useMemo(() => new RepositoriesController({
    setListing, setSync, setQuery, setLoadState, setAddState, setDismissed,
    setRefreshNotice, setNow, setCooldownUntil,
  }), []);

  useEffect(() => buildLoadEffect(controller)(), [controller]);

  return RepositoriesHelper.render(
    {
      listing, sync, query, loadState, addState, dismissed, refreshNotice, now, cooldownUntil,
    },
    RepositoriesHandlers.build(controller),
  );
}
