import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ALLOWED_LINK = /^(https?:|mailto:)/i;
const WEB_URL = /^https?:/i;
const PHRASING_PARENTS = new Set(['paragraph', 'heading', 'emphasis', 'strong', 'delete', 'link', 'tableCell']);
const IMAGE_FALLBACK_LABEL = 'image';

/**
 * Keep only the URLs a body may link to (`http:`, `https:` and `mailto:`).
 *
 * @param {string} url - The URL found in the Markdown.
 * @returns {string} The same URL when allowed, otherwise an empty string (relative and
 *   protocol-relative URLs, `javascript:`, `data:`, `vbscript:`, `file:` and the rest).
 */
function allowedUrl(url) {
  return ALLOWED_LINK.test(url) ? url : '';
}

/**
 * Turn the raw HTML nodes of a tree into text, so HTML is shown escaped and never interpreted
 * (and never silently dropped).
 *
 * @param {{type: string, value: (string|undefined), children: (object[]|undefined)}} node - A
 *   Markdown tree node; its children are visited too.
 * @returns {void}
 */
function htmlToText(node) {
  const children = node.children ?? [];
  const inline = PHRASING_PARENTS.has(node.type);

  children.forEach((child, index) => {
    if (child.type !== 'html') {
      htmlToText(child);
      return;
    }

    const text = { type: 'text', value: child.value };

    children[index] = inline ? text : { type: 'paragraph', children: [text] };
  });
}

/**
 * Remark plugin showing raw HTML as text.
 *
 * @returns {Function} The tree transformer.
 */
function remarkHtmlAsText() {
  return htmlToText;
}

/**
 * Renders a link, only for an allowed URL; any other URL leaves its text.
 *
 * @param {{href: (string|undefined), children: *}} props - The link's `href` and text.
 * @returns {React.ReactElement} The link, or the text alone.
 */
function BodyLink({ href, children }) {
  if (!ALLOWED_LINK.test(href ?? '')) {
    return <>{children}</>;
  }

  return <a href={href} rel="noopener noreferrer" target="_blank">{children}</a>;
}

/**
 * Renders an image as a link labelled with its alt text (`http`/`https` only) or as text. It
 * never renders an `<img>`, so no request leaves the browser for it.
 *
 * @param {{src: (string|undefined), alt: (string|undefined)}} props - The image's URL and alt.
 * @returns {React.ReactElement} The link or the text.
 */
function BodyImage({ src, alt }) {
  const label = alt || IMAGE_FALLBACK_LABEL;

  if (!WEB_URL.test(src ?? '')) {
    return <>{label}</>;
  }

  return <a href={src} rel="noopener noreferrer" target="_blank">{label}</a>;
}

/**
 * Renders a task-list checkbox, always disabled (toggling it would edit the body).
 *
 * @param {object} props - The input's props.
 * @returns {React.ReactElement} The disabled input.
 */
function BodyInput(props) {
  // eslint-disable-next-line no-unused-vars -- the tree node is not a DOM attribute
  const { node, ...rest } = props;

  return <input {...rest} disabled readOnly />;
}

const COMPONENTS = { a: BodyLink, img: BodyImage, input: BodyInput };
const REMARK_PLUGINS = [remarkGfm, remarkHtmlAsText];

/**
 * Renders a GitHub-flavoured Markdown body under the restricted rules of the Issues security
 * spec: raw HTML shown as text, links limited to `http`/`https`/`mailto`, images never loaded,
 * task checkboxes disabled, and `@mention`, `#123` and SHAs left as plain text.
 *
 * @description Loaded lazily by {@link IssueBody}. No `rehype-raw` and no
 * `dangerouslySetInnerHTML`.
 * @param {{body: string}} props - The body's Markdown source.
 * @returns {React.ReactElement} The rendered body.
 */
export default function IssueBodyMarkdown({ body }) {
  return (
    <Markdown remarkPlugins={REMARK_PLUGINS} urlTransform={allowedUrl} components={COMPONENTS}>
      {body}
    </Markdown>
  );
}
