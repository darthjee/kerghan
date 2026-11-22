const GITHUB_PREFIX = 'https://github.com/';

/**
 * The `#N` link to a GitHub issue (S2).
 *
 * @description Renders nothing unless `url` starts with `https://github.com/`; the link opens
 * with `rel="noopener noreferrer"` and `target="_blank"`.
 * @param {{number: number, url: string}} props - The GitHub issue's number and URL.
 * @returns {React.ReactElement|null} The link, or `null` for any other URL.
 */
export default function GithubLink({ number, url }) {
  if (typeof url !== 'string' || !url.startsWith(GITHUB_PREFIX)) {
    return null;
  }

  return <a href={url} rel="noopener noreferrer" target="_blank">{`#${number}`}</a>;
}
