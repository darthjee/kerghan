import { useState } from 'react';
import useRateLimitCountdown from '../../../../common/forms/hooks/useRateLimitCountdown.js';
import IssueNumberModalHelper from './IssueNumberModalHelper.jsx';

/**
 * Shared modal of the import and attach flows: one input taking `12`, `#12` or a GitHub issue
 * URL, with the error shown inside and the typed value kept.
 *
 * @description Submit is disabled in flight (U2) and shows a spinner. A rate-limited submit
 * (`ISSUE_LINK_RATE_LIMITED`, `GITHUB_RATE_LIMITED`) reads "Try again in N s" and is enabled
 * again at 0; nothing is resubmitted automatically.
 * @param {{title: string, submitLabel: string, pending: boolean, error: (object|null),
 *   onSubmit: Function, onCancel: Function}} props - The title, the submit button's name, the
 *   in-flight flag, the described error, the callback receiving the typed text, and the cancel
 *   callback.
 * @returns {React.ReactElement} The rendered modal.
 */
export default function IssueNumberModal({
  title, submitLabel, pending, error, onSubmit, onCancel,
}) {
  const [value, setValue] = useState('');
  const countdown = useRateLimitCountdown(error?.retryAfterSeconds);

  return IssueNumberModalHelper.render(
    {
      title, submitLabel, value, pending, error, countdown,
    },
    {
      onChange: (event) => setValue(event.target.value),
      onSubmit: (event) => {
        event.preventDefault();
        onSubmit(value);
      },
      onCancel,
    },
  );
}
