import { useMemo, useState } from 'react';
import ImportIssueController from './ImportIssueController.js';
import IssueNumberModal from './IssueNumberModal.jsx';

/**
 * Modal that imports a GitHub issue of the project's repository as a new linked issue, then
 * goes to its page.
 *
 * @param {{projectId: string, repository: {fullName: string}, onClose: Function}} props - The
 *   project's uuid, its repository (a URL of another repository is rejected) and the callback
 *   that closes the modal.
 * @returns {React.ReactElement} The rendered modal.
 */
export default function ImportIssueModal({ projectId, repository, onClose }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const controller = useMemo(() => new ImportIssueController({ setPending, setError, onClose }), [onClose]);

  return (
    <IssueNumberModal
      title="Import a GitHub issue"
      submitLabel="Import"
      pending={pending}
      error={error}
      onSubmit={(raw) => controller.submit(projectId, repository, raw)}
      onCancel={onClose}
    />
  );
}
