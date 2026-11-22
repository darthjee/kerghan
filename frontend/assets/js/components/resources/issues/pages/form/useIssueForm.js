import { useCallback, useMemo, useRef, useState } from 'react';
import useDirtyFormGuard from '../../../../common/forms/hooks/useDirtyFormGuard.js';
import useRateLimitCountdown from '../../../../common/forms/hooks/useRateLimitCountdown.js';
import ProjectPaths from '../../../projects/paths.js';
import useFocusReread from '../../sync/useFocusReread.js';
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
 * On the edit form, window focus (throttled to 30 s) re-reads the issue without touching the
 * fields; a later `updatedAt` shows the U10 banner, whose action resets the form to the fresh
 * issue.
 * @param {{project: object, issue: (object|null), onNotFound: Function}} options - The project,
 *   the issue being edited (`null` to create one) and the callback for a project or issue that
 *   turned out to be gone.
 * @returns {{state: object, handlers: object, guard: object}} The form's state, its event
 *   handlers, and the dirty-form guard.
 */
export default function useIssueForm({ project, issue, onNotFound }) {
  const [initial, setInitial] = useState(() => startFields(issue));
  const [fields, setFields] = useState(initial);
  const [loaded, setLoaded] = useState(issue);
  const [changedIssue, setChangedIssue] = useState(null);
  const loadedAt = useRef(issue?.updatedAt);
  const issueId = issue?.id;
  const [tab, setTab] = useState('write');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const countdown = useRateLimitCountdown(formError?.retryAfterSeconds);
  const controller = useMemo(
    () => new IssueFormController({
      setFieldErrors, setFormError, setSubmitting, setChangedIssue,
    }, onNotFound),
    [onNotFound],
  );
  const guard = useDirtyFormGuard(IssueFormController.isDirty(fields, initial));
  const onFocusReread = useCallback(() => {
    if (issueId !== undefined) {
      controller.checkChanged(project.id, issueId, loadedAt.current);
    }
  }, [controller, project.id, issueId]);
  const discardAndReload = () => {
    const reloaded = IssueFormController.reloaded(changedIssue);

    setInitial(reloaded.fields);
    setFields(reloaded.fields);
    setLoaded(changedIssue);
    setChangedIssue(null);
    setFieldErrors({});
    setFormError(null);
    loadedAt.current = reloaded.updatedAt;
  };
  const change = (field, value) => {
    setFields((current) => ({ ...current, [field]: value }));
    controller.fieldChanged(field);
  };

  useFocusReread(onFocusReread);

  return {
    guard,
    state: {
      mode: issue === null ? 'new' : 'edit',
      ...fields,
      tab,
      link: loaded?.link ?? null,
      changed: changedIssue !== null,
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
      onDiscardAndReload: discardAndReload,
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
