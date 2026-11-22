import { useEffect, useMemo, useState } from 'react';
import useRateLimitCountdown from '../../../../common/forms/hooks/useRateLimitCountdown.js';
import ProjectHeaderHelper from './ProjectHeaderHelper.jsx';
import ProjectRefreshController from './ProjectRefreshController.js';

/**
 * The project page's header, with "Refresh project" (T3) and the entry to import from GitHub.
 *
 * @description A rate-limited refresh (`GITHUB_RATE_LIMITED`) shows the shared countdown on its
 * button. The refresh's single re-read timer is cleared on unmount.
 * @param {{project: object, onImport: Function, onReloadList: Function,
 *   onReloadProject: Function}} props - The project, the callback opening the import modal, and
 *   the callbacks re-reading the list's current page and the project.
 * @returns {React.ReactElement} The rendered header.
 */
export default function ProjectHeader({
  project, onImport, onReloadList, onReloadProject,
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const countdown = useRateLimitCountdown(error?.retryAfterSeconds);

  const controller = useMemo(() => new ProjectRefreshController({
    setRefreshing, setNotice, setError, onReloadList, onReloadProject,
  }), [onReloadList, onReloadProject]);

  useEffect(() => () => controller.dispose(), [controller]);

  return ProjectHeaderHelper.render(
    {
      project, refreshing, notice, error, countdown,
    },
    { onImport, onRefresh: () => controller.refresh(project.id) },
  );
}
