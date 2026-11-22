const HINTS = new Map([
  ['unavailable', { text: 'Unavailable: sync and linking are paused', link: { href: '#/repositories', text: 'Open repositories' } }],
  ['unknown', { text: 'Unknown: not seen in the last repository sync' }],
]);

/**
 * The hint under a project's repository label, from the repository's status.
 *
 * @description Renders nothing for a project without a repository and for an added repository.
 * Unavailable says sync and linking are paused, with a link to the Repositories page; Unknown
 * says the repository was not seen in the last sync (linking still works).
 * @param {{repository: ({status: string}|null)}} props - The project's `repository` object, or
 *   `null`.
 * @returns {React.ReactElement|null} The hint, or `null` when there is none to show.
 */
export default function RepositoryHint({ repository }) {
  const hint = HINTS.get(repository?.status);

  if (hint === undefined) {
    return null;
  }

  return (
    <div className="text-muted small">
      {hint.text}
      {hint.link ? <>{' '}<a href={hint.link.href}>{hint.link.text}</a></> : null}
    </div>
  );
}
