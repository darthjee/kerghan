# Security static spec and docs
Extend `frontend/specs/assets/js/components/resources/projects/securityStaticSpec.js` (or add an issues sibling) to cover `components/resources/issues/` and `components/common/forms/RateLimitCountdownController.js`. It checks for:

- no `dangerouslySetInnerHTML`, `.innerHTML` or `.outerHTML`
- no `rehype-raw` (or any `rehype` raw plugin) import anywhere under `components/resources/issues/`
- no `localStorage` or `sessionStorage` use (S4)
- titles rendered as text: a render check with a title such as `<b>x</b>` shows the escaped text in the list, on the page and in the forms
- no integration or credential wording on the issue screens (S5)

Update the docs:

- `docs/agents/architecture/frontend.md`: the issues module layout, the issue routes, `IssueBody` and its lazy chunk, the countdown, and the `react-markdown` and `remark-gfm` dependency
- the #561 row of the implementation table in `docs/agents/specs/issues.md`, aligned with the issue's *Builds against* list: `ui.md`, `ui/screens-and-flows.md`, `ui/linking-and-sync.md` (badges), `ui/decisions.md`, `ui/states.md`, `security.md`, `api/issues.md` and `testing.md#frontend-tests`

## Files to Change
- `frontend/specs/assets/js/components/resources/projects/securityStaticSpec.js` — extend to the issue screens
- `docs/agents/architecture/frontend.md` — document the issues module
- `docs/agents/specs/issues.md` — align the #561 row
