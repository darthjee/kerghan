# Issue: Issues: fold the specs into the permanent docs

## Description

This issue is part of epic #483 (Issues and Projects). Kerghan gets **projects**, each optionally connected to one repository. It also gets **issues** that belong to a project and may be linked one to one to a GitHub issue. Background workers keep each linked pair in sync both ways. The specs define the feature in `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md`, and the lifecycle is in `docs/agents/specs.md`.

This is the **last issue** of the feature. Every implementation issue (#553 to #563, and #507) is merged. It folds the specs into the permanent docs and then deletes them, as lifecycle steps 3 and 4 of `docs/agents/specs.md` require. It adds no product code. The specs are the source of truth, and this issue makes no product decision of its own: the permanent docs say what the specs say. #492 spawned the implementation issues.

## Builds against

- `docs/agents/specs.md` (the lifecycle and the *Completed specs* table)
- `docs/agents/specs/issues.md` (the index)
- `docs/agents/specs/issues/model.md#persistence-statement-and-fold-list` (the persistence statement and the fold list)
- every other file under `docs/agents/specs/issues/`, as the source of what is folded
- the Repositories fold (#444), as the layout to follow: `docs/agents/modules/repositories.md` with its pages under `modules/repositories/`, and `docs/agents/backend/routes/repositories.md` with its pages under `backend/routes/repositories/`

## Depends on

- #553 to #563 and #507, all merged

## Task

- **Fold the specs into the permanent docs.** Mirror the Repositories layout (a short hub plus pages, so no page grows too long):
  - `docs/agents/modules/issues.md` (hub), with pages under `docs/agents/modules/issues/` for the data model, projects, the GitHub link, sync, security, edge cases, the frontend, testing and the required tests.
  - `docs/agents/backend/routes/issues.md` (hub), with pages under `docs/agents/backend/routes/issues/` for the projects routes, the issues routes, the GitHub-link and trigger routes, and errors and validation.
  - `docs/agents/environment-variables.md`: the nine `KERGHAN_ISSUES_*` variables, none of which it lists yet (the project and per-project issue caps, the edit and link rate-limit windows and maxima, the sync cooldown, the retry count, and the staleness threshold).
  - `docs/agents/product.md`: an Issues and Projects section, plus the fold-list statements ("What the backend persists", "Issue fetching model", "GitHub access", and the two Deferred items), rewritten to the persistence statement of `model.md`. Fetched GitHub issue data stays "not persisted by default". Kerghan persists its own projects, issues, links and markers and, for a linked issue only, a snapshot of its GitHub data. The backend reads and writes GitHub for linked issues with the owner's credential inside the Integrations module, as a narrow exception to "read by the browser". "Opt-in issue persistence" stays deferred and distinct.
  - The rest of the fold list: `docs/agents/architecture/security.md` ("GitHub credentials stay in the backend", including the narrowed rule that replaces "Fixed operations: `GET`-only"), `docs/agents/summary.md` and `docs/agents/flow.md`.
  - `docs/agents/modules/workers.md`, `docs/agents/modules/integrations/github-service/*.md`, `docs/agents/architecture/frontend.md` and any other permanent doc that links into `specs/issues`: repoint them to the new pages.
- **Repository-removal rule.** Copy it into `docs/agents/modules/repositories.md`, under *Not built*: a future "remove an added repository" feature must refuse with `409` while a non-deleted project of the user uses the repository. The open question in `model.md` (how that feature learns a live project uses a repository) has no owner issue and stays out of scope. Only the rule is copied.
- **Agent files.** Switch the Issues and Projects row of the map of decided areas in `.claude/agents/product-owner.md` from `specs/issues.md` to the permanent docs. Also repoint `.claude/agents/data-access.md`, which links into the spec folder.
- **`AGENTS.md` and `CLAUDE.md`.** Apply exactly the wording approved in [Approved root-file edits](#approved-root-file-edits) below, and change nothing else in those two files. Following the `specs.md` rule, they link only to the hub (`docs/agents/specs.md`), never to the new module docs.
- **Code that points at the specs.** About 73 files under `backend/` and `frontend/` cite `docs/agents/specs/issues/...` in comments. Repoint every one to the permanent page that now holds the rule, and leave no dangling `specs/issues` path anywhere in the repository outside `docs/agents/issues/` and `docs/agents/plans/`.
  - `backend/src/issues/tests/edge-cases.coverage.spec.ts` reads `docs/agents/specs/issues/edge-cases.md` from disk. Point it at the folded edge-case page, so the E-id sweep keeps running after the spec is deleted. Keep the E-ids unchanged.
- **Required-tests audit.** Check that every Required test of every spec file is implemented on the tier that `testing.md` gives it. Add any test that is missing in this same PR, through the owning agent. The folded `required-tests.md` page lists each Required test with the spec that covers it.
- **Delete the specs.** Delete `docs/agents/specs/issues.md` and `docs/agents/specs/issues/`. In `docs/agents/specs.md`, move the entry from *Active specs* (which then reads "None.") to the *Completed specs* table. That row points at the new docs, with #483 as the product decision.

### Approved root-file edits

The user approved this wording on 2026-11-23, while refining this issue. That approval stands in for the "ask before touching them" step of the fold list.

`AGENTS.md`, project overview. The credentials parenthetical becomes "used by the backend to list their repositories and to sync linked issues, not for fetching issues live". The sentences from "Issue data itself is fetched live" to "not the current behavior." become:

> Fetched GitHub issue data is read live, on demand, by the frontend calling GitHub's public API directly. Each user's own browser IP (Internet Protocol) address absorbs GitHub's unauthenticated rate limit instead of the backend's shared one, and that data is not persisted by default. Users can also create projects, each optionally connected to one added repository, holding Kerghan's own issues, which may be linked one to one to a GitHub issue. Kerghan persists those projects, issues and links and, for a linked issue only, a snapshot of its GitHub data. Background workers sync each linked pair both ways through the backend, with the project owner's integration credential (see [Specs](docs/agents/specs.md)). Opt-in persistence of fetched issues (for history/trends) is a future addition.

`AGENTS.md`, the "lightweight per-user account" bullet. "issue data is still read by the browser, unauthenticated (public-repo only)" becomes "fetched issue data is still read by the browser, unauthenticated (public-repo only); a linked Kerghan issue is read and written by the backend, inside the Integrations module, with the project owner's credential".

`CLAUDE.md`, *Boundaries*, the integrations bullet. "Issue fetching itself still reads GitHub unauthenticated (public-repo only), in the browser." becomes:

> Issue fetching itself still reads GitHub unauthenticated (public-repo only), in the browser. The one exception is a linked Kerghan issue, which the backend reads and writes inside the Integrations module with the project owner's credential, as defined by the Issues and Projects entry in `docs/agents/specs.md`.

In the next bullet, "The backend lists repositories with an integration's credential or a GitHub handle's public listing" becomes "The backend lists repositories with an integration's credential or a GitHub handle's public listing, and syncs linked issues with the project owner's credential".

## Out of scope

- The repository-removal feature itself, and the open question about how it learns that a live project uses a repository.
- Any product or behavior change. If folding shows a spec and the code disagree, the code follows the spec, or the disagreement is raised. The permanent docs are never bent to match the code.

## Acceptance criteria

- Every statement of the fold list is rewritten, and the new module and route docs hold everything the specs decided.
- `docs/agents/specs/issues.md` and `docs/agents/specs/issues/` no longer exist, and `docs/agents/specs.md` lists the feature under *Completed specs*, with *Active specs* reading "None.".
- `grep -rn "specs/issues" .` finds nothing outside `docs/agents/issues/`, `docs/agents/plans/` and `node_modules/`.
- `AGENTS.md` and `CLAUDE.md` change only as approved above.
- The Required tests of every spec file are implemented on their tier, and any gap the audit found is filled in this PR.
- The checks pass:
  - `docker-compose run --rm kerghan_tests yarn coverage`, including `edge-cases.coverage.spec.ts` against the new path
  - `docker-compose run --rm kerghan_tests yarn lint`
  - the DB-backed tier, if the audit adds a DB-backed test
  - `docker-compose run kerghan_fe yarn coverage`
  - `docker-compose run kerghan_fe yarn lint`

## Notes

- **Responsible agent:** `architect`, for the docs, the agent files and the root files. `backend` handles the backend comment repoints, the coverage-spec path and any missing backend test. `frontend` handles the frontend comment repoints and any missing frontend test.
- **Review:** `product-owner`, checking that the folded docs decide nothing new and that the map row is correct.
