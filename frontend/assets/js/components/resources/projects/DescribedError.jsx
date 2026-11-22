/**
 * An error described by `ProjectErrorMessages.describe`, rendered as text: its message, a link
 * to the existing project when it has one, and its validation details when it has any (S1).
 *
 * @param {{error: {message: string, link: ({href: string, text: string}|undefined),
 *   details: (string[]|undefined)}, className: (string|undefined),
 *   role: (string|undefined)}} props - The described error, and the container's class and ARIA
 *   role (field errors are plain feedback, form-level errors are alerts).
 * @returns {React.ReactElement} The error.
 */
export default function DescribedError({ error, className, role }) {
  return (
    <div className={className} role={role}>
      {error.message}
      {error.link ? <>{' '}<a href={error.link.href}>{error.link.text}</a></> : null}
      {error.details?.length > 0 ? (
        <ul className="mb-0">
          {error.details.map((detail) => <li key={detail}>{detail}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
