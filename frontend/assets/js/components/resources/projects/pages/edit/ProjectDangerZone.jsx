import { useMemo, useState } from 'react';
import ProjectDeleteController from './ProjectDeleteController.js';
import ProjectDangerHelper from './ProjectDangerHelper.jsx';

/**
 * Danger zone of project management: "Delete project", behind a confirmation that needs the
 * project's name typed. A successful deletion goes to the project list with a one-time notice.
 *
 * @param {{project: object, guard: object}} props - The project, and the page's dirty-form
 *   guard (the deletion leaves the page without the "unsaved changes" prompt).
 * @returns {React.ReactElement} The rendered section.
 */
export default function ProjectDangerZone({ project, guard }) {
  const [confirming, setConfirming] = useState(false);
  const controller = useMemo(() => new ProjectDeleteController(), []);

  return ProjectDangerHelper.render(
    { project, confirming },
    {
      onOpen: () => setConfirming(true),
      onDelete: () => controller.remove(project.id, guard.forceLeave),
      onCancel: () => setConfirming(false),
    },
  );
}
