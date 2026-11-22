import DirtyFormPrompt from '../../../../common/forms/DirtyFormPrompt.jsx';
import IssueFormHelper from './IssueFormHelper.jsx';
import useIssueForm from './useIssueForm.js';

/**
 * The issue create or edit form, once its project (and issue) are loaded. It starts from the
 * issue's values (or empty) and guards unsaved changes (U11).
 *
 * @param {{project: object, issue: (object|null), onNotFound: Function}} props - The project,
 *   the issue being edited (`null` to create one) and the callback for a project or issue that
 *   turned out to be gone (`404`).
 * @returns {React.ReactElement} The rendered form and its leave prompt.
 */
export default function IssueFormSection({ project, issue, onNotFound }) {
  const { state, handlers, guard } = useIssueForm({ project, issue, onNotFound });

  return (
    <>
      {IssueFormHelper.render(state, handlers)}
      <DirtyFormPrompt guard={guard} />
    </>
  );
}
