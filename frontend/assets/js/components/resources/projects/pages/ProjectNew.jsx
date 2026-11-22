import { useMemo, useState } from 'react';
import DirtyFormPrompt from '../../../common/forms/DirtyFormPrompt.jsx';
import useDirtyFormGuard from '../../../common/forms/hooks/useDirtyFormGuard.js';
import currentHash from '../../../../utils/routing/currentHash.js';
import ProjectErrorMessages from '../errors/errorMessages.js';
import ProjectPaths from '../paths.js';
import ProjectNewController from './new/ProjectNewController.js';
import ProjectNewHelper from './new/ProjectNewHelper.jsx';

/**
 * Explicit project creation form (`#/projects/new`): Name, Description and an optional
 * Repository chosen among the added ones. It starts prefilled from the hash query (the
 * shortcut's fallback) and guards unsaved changes (U11).
 *
 * @returns {React.ReactElement} The rendered form.
 */
export default function ProjectNew() {
  const initial = useMemo(() => ProjectNewController.parsePrefill(currentHash()), []);
  const [fields, setFields] = useState(initial.fields);
  const [fieldErrors, setFieldErrors] = useState(
    initial.nameTaken ? { name: { message: ProjectErrorMessages.nameTaken } } : {},
  );
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const controller = useMemo(
    () => new ProjectNewController({ setFieldErrors, setFormError, setSubmitting }),
    [],
  );
  const guard = useDirtyFormGuard(ProjectNewController.isDirty(fields, initial.fields));

  const change = (field, value) => {
    setFields((current) => ({ ...current, [field]: value }));
    controller.fieldChanged(field);
  };

  const handlers = {
    onNameChange: (event) => change('name', event.target.value),
    onDescriptionChange: (event) => change('description', event.target.value),
    onRepositoryChange: (repository) => change('repository', repository),
    onSubmit: (event) => {
      event.preventDefault();
      return controller.submit(fields, guard.forceLeave);
    },
    onCancel: () => guard.leave(ProjectPaths.list),
  };

  return (
    <>
      {ProjectNewHelper.render({
        ...fields, fieldErrors, formError, submitting,
      }, handlers)}
      <DirtyFormPrompt guard={guard} />
    </>
  );
}
