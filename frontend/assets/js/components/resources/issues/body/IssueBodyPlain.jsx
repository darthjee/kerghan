import React from 'react';

/**
 * Renders an issue's body as plain text, the fallback shown while the Markdown chunk loads.
 *
 * @description Shows the Markdown source untouched inside a `<pre>`; React escapes it, so no
 * markup in the body is ever interpreted.
 * @param {{body: string}} props - The body's Markdown source.
 * @returns {React.ReactElement} The plain-text body.
 */
export default function IssueBodyPlain({ body }) {
  return <pre className="issue-body-plain">{body}</pre>;
}
