# Issue: Issues: projects API

## Description

This is part of the epic #483 (Issues and Projects): Kerghan gets **projects** (optionally connected to one repository) and **issues** that belong to a project and may be linked one to one to a GitHub issue, kept in sync both ways by background workers. The feature is defined as specs under `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md` (the lifecycle is in `docs/agents/specs.md`), and the specification phase is finished. This issue builds the **Projects API**. The specs are the source of truth: this issue makes no product decision of its own, and a change of decision updates the spec in the same PR (`docs/agents/specs.md`, lifecycle step 2). The implementation issues were spawned by #492.

## Builds against

- `docs/agents/specs/issues.md` (the index)
- `docs/agents/specs/issues/projects.md` (all of it)
- `docs/agents/specs/issues/api.md` (every route, exposed identifiers, required tests)
- `docs/agents/specs/issues/api/projects.md` (including the open-issue count) and `docs/agents/specs/issues/api/errors-and-validation.md`
- `docs/agents/specs/issues/security.md#quotas-and-abuse-limits` (the projects cap)
- `docs/agents/specs/issues/edge-cases.md`: E25 to E29 and E33 to E40 (projects and status mapping)

## Task

- The routes `/projects/mine.json`, `create.json`, `from-repository.json` and, under `/projects/:projectId/`, `show`, `edit`, `repository` and `delete`, all `POST` and ending in `.json`.
- The creation paths (`200`/`201`/`409`), the repository ref, repository change and detach (`409 PROJECT_HAS_LINKS` while links exist), soft delete with `deleted_token`, the projects cap (`PROJECTS_LIMIT_REACHED`), the refusal data in `error.meta`, the error catalogue and the input validation rules.
- `openIssueCount` on every project object, as `api/projects.md#open-issue-count` specifies: one indexed `COUNT` for show, edit, repository change and the shortcut's existing-project `200`; `0` without a query on create and the shortcut's `201`; exactly one grouped query per listing page.
- Thin controllers; logic in the `issues` module services, using the single access check of the foundation (`IssuesAccess`).

## Scope

- **Already built by #553 (merged):** the `issues` module, the four tables and entities, `IssuesConfig` (including `KERGHAN_ISSUES_MAX_PROJECTS_PER_USER`), `IssuesAccess.findLiveProject` and `issues-http-errors.ts` with the two `404` helpers. Reuse them.
- **Error codes:** only the codes these routes throw join `ErrorCodes` here (`PROJECTS_LIMIT_REACHED`, `PROJECT_NAME_TAKEN`, `PROJECT_REPOSITORY_TAKEN`, `PROJECT_REPOSITORY_NOT_ADDED`, `PROJECT_HAS_LINKS`), with their helpers in `issues/issues-http-errors.ts`. The other codes of the catalogue arrive with the issues that throw them.
- **`error.meta`:** this issue adds the optional `error.meta` to the standard error shape (`core/http-exception.filter.ts`) and describes it in `docs/agents/architecture/backend/error-responses.md` in the same change.
- **Code-point lengths:** the validator that counts Unicode code points (E14) is shared, so #556 reuses it for titles and bodies.
- **Open-issue count:** built here in full (decision of this refinement). #563 keeps bulk close/reopen and the frontend count only.
- **E62 (repository change against link creation):** this issue builds and tests the change side: the project row is locked first, links are counted under that lock, `PROJECT_HAS_LINKS` is tested against seeded links, and a `(db)` test shows a repository change waits on a held project lock. The full race test against real link creation belongs to #557, which builds link creation.
- **Not here:** the refresh trigger route (#558), the issue routes (#556), the link routes (#557) and the "GitHub work uses the owner's credentials" test (#557/#558).

## Depends on

- #553 (Issues: foundation), merged

## Acceptance criteria

- The Required tests of every spec file listed under *Builds against* that concern these seven routes are implemented, each on the tier given by [`testing.md`](https://github.com/darthjee/kerghan/blob/main/docs/agents/specs/issues/testing.md) (default tier by category and the coverage per area).
- The creation races `(db)` (both paths, repository and name), the change side of the repository-change race `(db)` as scoped above, and the route access matrix rows of these routes.
- `openIssueCount` is on every project object, reads `0` without open issues, counts linked issues by local state, and the listing issues exactly one grouped count query per page whatever the page size `(db)`.
- No decision differs from the specs; if one has to, the spec is updated in the same PR.
- The checks of the owning agent pass.

## Notes

Responsible agent: `backend`.
- Routes: ask the `cache` agent for the cache-class review (`@CachePolicy(CacheClass.UserScoped)`, `X-Skip-Cache`, nothing in Navi), and the `security` and `data-access` agents for the checklists of `docs/agents/specs/issues/security.md#review-checklist`.
