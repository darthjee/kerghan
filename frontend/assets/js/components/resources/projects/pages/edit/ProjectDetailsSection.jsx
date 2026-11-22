import { useEffect, useMemo, useState } from 'react';
import ProjectPaths from '../../paths.js';
import ProjectDetailsController from './ProjectDetailsController.js';
import ProjectDetailsHelper from './ProjectDetailsHelper.jsx';

/**
 * Details section of project management: edit the name and description, Save (`edit.json`,
 * back to the project page) or Cancel (back, without a call, through the dirty-form guard).
 *
 * @param {{project: object, guard: object, onDirtyChange: Function, onNotFound: Function}}
 *   props - The project, the page's dirty-form guard, the callback told whether the form has
 *   unsaved changes, and the callback for a project that turned out to be gone.
 * @returns {React.ReactElement} The rendered section.
 */
export default function ProjectDetailsSection({
  project, guard, onDirtyChange, onNotFound,
}) {
  const initial = useMemo(() => ({ name: project.name, description: project.description ?? '' }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [fields, setFields] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const controller = useMemo(
    () => new ProjectDetailsController({ setFieldErrors, setFormError, setSubmitting }, onNotFound),
    [onNotFound],
  );
  const dirty = ProjectDetailsController.isDirty(fields, initial);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const change = (field, value) => {
    setFields((current) => ({ ...current, [field]: value }));
    controller.fieldChanged(field);
  };

  return ProjectDetailsHelper.render(
    {
      ...fields, fieldErrors, formError, submitting,
    },
    {
      onNameChange: (event) => change('name', event.target.value),
      onDescriptionChange: (event) => change('description', event.target.value),
      onSubmit: (event) => {
        event.preventDefault();
        return controller.save(project.id, fields, guard.forceLeave);
      },
      onCancel: () => guard.leave(ProjectPaths.show(project.id)),
    },
  );
}
