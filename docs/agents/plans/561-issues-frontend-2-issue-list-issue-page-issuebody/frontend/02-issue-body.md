# IssueBody (restricted Markdown, lazy-loaded)
Add the dependencies through docker-compose only: `docker-compose run kerghan_fe yarn add react-markdown@<exact> remark-gfm@<exact>`. Pin exact versions and commit `package.json` and `yarn.lock`.

Build the renderer in `components/resources/issues/body/IssueBodyMarkdown.jsx`. It uses `react-markdown` with `remarkPlugins={[remarkGfm]}`, no `rehype-raw` and no raw-HTML plugin, and it meets the rendering table of `security.md#bodies-restricted-markdown`:

- **Raw HTML:** not interpreted. react-markdown without `rehype-raw` drops HTML nodes, so make sure raw HTML shows as escaped text, for example by mapping `html` nodes to text. The rule is that it is shown, not dropped.
- **Links:** `urlTransform` keeps only `http:`, `https:` and `mailto:` URLs. The `a` override renders `rel="noopener noreferrer"` and `target="_blank"` for an allowed URL, and only its text for any other scheme, a relative URL or a protocol-relative (`//`) URL.
- **Images:** the `img` override never renders `<img>`. It renders a link labelled with the alt text (or "image") when the URL is `http`/`https`, and text otherwise.
- **Task lists:** checkboxes are disabled.
- **`@mention`, `#123` and SHAs:** stay plain text, with no autolink plugin beyond GFM's URL autolinks.

Add `components/resources/issues/body/IssueBody.jsx`, the public component:

- `React.lazy(() => import('./IssueBodyMarkdown.jsx'))` inside `Suspense`, so Vite gives it its own chunk
- the fallback renders the body as plain text in a `<pre>` (P5)
- an empty or `null` body renders a muted "No description." without loading the chunk

Specs:

- one unit spec per row of the rendering table, against `IssueBodyMarkdown`: raw `<script>`, `<iframe>` and `<details>` shown as text; `javascript:`, `data:`, `vbscript:`, `file:`, relative and protocol-relative links as text; `http`, `https` and `mailto` with `rel` and `target`; an image with no `<img>` (and, with a stubbed `fetch`, no request); disabled task checkboxes; plain `@mention` and `#123`
- `IssueBody`, rendered with `renderToStaticMarkup`, shows the `<pre>` fallback, and an empty body shows "No description."

## Files to Change
- `frontend/package.json`, `frontend/yarn.lock` — `react-markdown` and `remark-gfm`, pinned
- `frontend/assets/js/components/resources/issues/body/IssueBodyMarkdown.jsx` — new
- `frontend/assets/js/components/resources/issues/body/IssueBody.jsx` — new, lazy wrapper
- `frontend/specs/assets/js/components/resources/issues/body/` — the specs
