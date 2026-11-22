import { useMemo, useState } from 'react';
import useDirtyFormGuard from '../../../../common/forms/hooks/useDirtyFormGuard.js';
import useRateLimitCountdown from '../../../../common/forms/hooks/useRateLimitCountdown.js';
import ProjectPaths from '../../../projects/paths.js';
import IssueFormController from './IssueFormController.js';

const NEW_FIELDS = { title: '', body: '', state: 'open' };

/**
 * Start values of the form: empty for a new issue, the issue's own to edit one.
 *
 * @param {(object|null)} issue - The issue being edited, `null` when creating.
 * @returns {{title: string, body: string, state: string}} The start fields.
 */
function startFields(issue) {
  if (issue === null) {
    return NEW_FIELDS;
  }

  return { title: issue.title, body: issue.body ?? '', state: issue.state };
}

/**
 * State and handlers of the issue create and edit forms.
 *
 * @description Holds the typed values, the selected Body tab, the errors, the in-flight flag,
 * the rate-limit countdown and the dirty-form guard (U11). Nothing is written to storage (S4).
 * @param {{project: object, issue: (object|null), onNotFound: Function}} options - The project,
 *   the issue being edited (`null` to create one) and the callback for a project or issue that
 *   turned out to be gone.
 * @returns {{state: object, handlers: object, guard: object}} The form's state, its event
 *   handlers, and the dirty-form guard.
 */
export default function useIssueForm({ project, issue, onNotFound }) {
  const initial = useMemo(() => startFields(issue), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [fields, setFields] = useState(initial);
  const [tab, setTab] = useState('write');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const countdown = useRateLimitCountdown(formError?.retryAfterSeconds);
  const controller = useMemo(
    () => new IssueFormController({ setFieldErrors, setFormError, setSubmitting }, onNotFound),
    [onNotFound],
  );
  const guard = useDirtyFormGuard(IssueFormController.isDirty(fields, initial));
  const change = (field, value) => {
    setFields((current) => ({ ...current, [field]: value }));
    controller.fieldChanged(field);
  };

  return {
    guard,
    state: {
      mode: issue === null ? 'new' : 'edit',
      ...fields,
      tab,
      link: issue?.link ?? null,
      fieldErrors,
      formError,
      submitting,
      countdown,
    },
    handlers: {
      onTitleChange: (event) => change('title', event.target.value),
      onBodyChange: (event) => change('body', event.target.value),
      onStateChange: (event) => change('state', event.target.value),
      onTabChange: setTab,
      onSubmit: (event) => {
        event.preventDefault();
        return issue === null
          ? controller.create(project.id, fields, guard.forceLeave)
          : controller.save(project.id, issue.id, fields, guard.forceLeave);
      },
      onCancel: () => guard.leave(issue === null ? ProjectPaths.show(project.id) : ProjectPaths.issue(project.id, issue.id)),
    },
  };
}
