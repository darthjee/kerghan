import { useMemo, useState } from 'react';
import ProjectRepositoryController from './ProjectRepositoryController.js';
import ProjectRepositoryHelper from './ProjectRepositoryHelper.jsx';

/**
 * Repository section of project management: shows the current repository and lets the user
 * connect, change or detach it. Each action acts at once, apart from the details Save.
 *
 * @param {{project: object, onProjectChange: Function, onNotFound: Function}} props - The
 *   project, the callback receiving the updated project, and the callback for a project that
 *   turned out to be gone.
 * @returns {React.ReactElement} The rendered section.
 */
export default function ProjectRepositorySection({ project, onProjectChange, onNotFound }) {
  const [picking, setPicking] = useState(false);
  const [confirmingDetach, setConfirmingDetach] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const controller = useMemo(
    () => new ProjectRepositoryController(
      {
        setPicking, setConfirmingDetach, setPending, setError,
      },
      { onProjectChange, onNotFound },
    ),
    [onProjectChange, onNotFound],
  );

  return ProjectRepositoryHelper.render(
    {
      repository: project.repository, picking, confirmingDetach, pending, error,
    },
    {
      onOpenPicker: () => controller.openPicker(),
      onClosePicker: () => controller.closePicker(),
      onPick: (repository) => controller.pick(project.id, repository),
      onConfirmDetach: () => controller.confirmDetach(true),
      onDetach: () => controller.detach(project.id),
      onCancelDetach: () => controller.confirmDetach(false),
    },
  );
}
