# Write the seven core spec files

Create, in `docs/agents/specs/issues/`: `projects.md`, `model.md`, `github-link.md`, `sync.md`, `api.md`, `security.md`, `ui.md`. Each file: a short intro with a link back to `../issues.md`, the decisions already made for its concern (nothing invented), then `## Open questions` (a `- [ ]` item per undecided point, each naming its owner issue in parentheses; omit the section when nothing is open), then `## Required tests`.

- **`projects.md`** (owner #485): the project as the home of issues; 0 or 1 linked repository; one private owner (another user's project answers 404); sharing out of scope but not blocked; explicit creation and the shortcut from an added repository. Open: one repository backing several projects, fields, repository removal, deletion, room for sharing. Tests: another user's project answers 404; a project without a repository can be created; a project can link one added repository.
- **`model.md`** (owner #486): entities (project, issue, GitHub link, pending marker), relations, ownership by user, the link unique on user and GitHub issue, a Kerghan issue holding at most one link. Open: columns and types, indexes, what GitHub data is stored, cleanup hooks, the `product.md` persistence change. Tests: the unique constraint; at most one link per issue.
- **`github-link.md`** (owner #487): one to one per user; optional; created from a GitHub issue or by attaching one; the GitHub issue must belong to the project's repository. Open: unlinking, deleted or transferred GitHub issues, repository change, link states. Tests: another repository's issue refused; a project with no repository cannot link; two users may link the same GitHub issue.
- **`sync.md`** (owner #488): two-way sync; on-demand triggers only; the durable pending marker re-enqueued at boot; rate limits via `retryAfterSeconds`, retry with cooldown, failed state; ids-only jobs; credentials stay in the Integrations module; depends on #479 (`WorkersService.register` / `enqueue`). Open: synced fields, conflicts, link states, staleness, no-write-credential case. Tests: a restart does not lose a pending write; exhausted retries mark the link failed; job params and logs carry no secrets.
- **`api.md`** (owner #489): principles only (user-scoped, 404 for another user's data, thin controllers, ids not secrets). Open: routes, payloads, errors, pagination, validation, sync state exposure, cache classes. Tests: another user's project or issue answers 404.
- **`security.md`** (owner #490): ownership scoping; credentials stay in the Integrations module; no endpoint returns a credential beyond the masked `secretHint`; the frontend never calls GitHub with a credential; safe log fields. Open: write-capable credential, content handling. Tests: no credential in any response, job param or log.
- **`ui.md`** (owner #491): the minimum pieces (project list, issue list, link state). Open: screens, creation flows, state display, empty and error states. Tests: none yet beyond the existence of those views (say so).

## Files to Change
- `docs/agents/specs/issues/projects.md` — new.
- `docs/agents/specs/issues/model.md` — new.
- `docs/agents/specs/issues/github-link.md` — new.
- `docs/agents/specs/issues/sync.md` — new.
- `docs/agents/specs/issues/api.md` — new.
- `docs/agents/specs/issues/security.md` — new.
- `docs/agents/specs/issues/ui.md` — new.
