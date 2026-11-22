import { useMemo, useState } from 'react';
import ConfirmModal from '../../../../common/confirmModal/ConfirmModal.jsx';
import AttachIssueController from './AttachIssueController.js';
import AttachWarning from './attachWarning.js';
import IssueNumberModal from './IssueNumberModal.jsx';

/**
 * Modal that attaches an issue to a GitHub issue of the project's repository.
 *
 * @description Asks for the issue number first. When GitHub's values differ it switches to the
 * warning (named for the fields only), offering "Replace and link" and Cancel; a second refusal
 * shows the warning again with the new differences (E61). `ISSUE_ALREADY_LINKED` closes it and
 * re-reads the issue (U3).
 * @param {{projectId: string, issue: object, repository: {fullName: string},
 *   onIssueChange: Function, onReread: Function, onNotFound: Function, onClose: Function}}
 *   props - The project's uuid, the issue, the project's repository, the setter of the issue,
 *   the callback that re-reads it, the callback for a vanished issue and the close callback.
 * @returns {React.ReactElement} The rendered modal.
 */
export default function AttachIssueModal({
  projectId, issue, repository, onIssueChange, onReread, onNotFound, onClose,
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const controller = useMemo(() => new AttachIssueController({
    setPending, setError, setWarning, onAttached: onIssueChange, onClose, onAlreadyLinked: onReread, onNotFound,
  }), [onIssueChange, onClose, onReread, onNotFound]);

  if (warning !== null) {
    return (
      <ConfirmModal
        title="Replace this issue's values?"
        message={AttachWarning.sentence(warning.differences)}
        confirmLabel="Replace and link"
        danger
        onConfirm={() => controller.confirm(projectId, issue.id, warning)}
        onCancel={onClose}
      />
    );
  }

  return (
    <IssueNumberModal
      title="Link to a GitHub issue"
      submitLabel="Link"
      pending={pending}
      error={error}
      onSubmit={(raw) => controller.submit(projectId, issue.id, repository, raw)}
      onCancel={onClose}
    />
  );
}
