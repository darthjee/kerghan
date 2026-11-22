import React, { Suspense, lazy } from 'react';
import IssueBodyPlain from './IssueBodyPlain.jsx';

const IssueBodyMarkdown = lazy(() => import('./IssueBodyMarkdown.jsx'));

/**
 * Renders an issue's body, the single place that renders any body.
 *
 * @description The Markdown renderer is a lazy chunk; until it loads the body shows as plain
 * text in a `<pre>`. An empty or missing body shows a muted "No description." and never loads
 * the chunk.
 * @param {{body: (string|null|undefined)}} props - The body's Markdown source.
 * @returns {React.ReactElement} The body.
 */
export default function IssueBody({ body }) {
  if (typeof body !== 'string' || body === '') {
    return <p className="text-muted">No description.</p>;
  }

  return (
    <Suspense fallback={<IssueBodyPlain body={body} />}>
      <IssueBodyMarkdown body={body} />
    </Suspense>
  );
}
