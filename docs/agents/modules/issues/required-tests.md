# Issues and Projects — Required tests

The index of every Required test of the Issues and Projects docs, with the spec that implements it. Part of the [Issues and Projects module](../issues.md).

Tiers, fakes and harnesses: [Testing](testing.md). Tags: `(db)`, `(e2e)`, `(unit)`, `(static)`, `(race)`, `(engine)` ([default tiers](testing.md#default-tier-by-category)). Each rule is tested from the "Required tests" section of the page that owns it, listed below. Backend paths are under `backend/src/issues/tests/` unless noted; "Int." is `backend/src/integrations/tests/`; frontend paths are under `frontend/specs/assets/js/`.

The audit that built this page (#564) found every Required test implemented on its tier and no gap that needs a product decision.

## Backend

| Section | Covered by | Tier |
|---|---|---|
| [Data model](data-model.md#required-tests): unique indexes, utf8mb4, `bigint`, `datetime(3)`, `status_reason` | `issues-tables.db-spec.ts` | db |
| Data model: migrations up and down | `database/tests/issues-migrations.db-spec.ts` | db |
| Data model: compare-and-clear, marker upsert, boot re-enqueue, cleanup contracts | `issue-sync-stores.db-spec.ts`, `issues.service.edit.db-spec.ts`, `issues-sync.restart.db-spec.ts`, `user-deleted.listener.db-spec.ts` | db |
| Data model: open-issue count query, bulk lock order and rollback | `open-issue-count.db-spec.ts`, `issues.service.bulk-state.db-spec.ts`, `races/bulk-state.race.db-spec.ts` | db, race |
| Data model: two-user baseline | `support/intruder-baseline.ts`, used by every DB and HTTP harness | db, e2e |
| [Projects](projects.md#required-tests): creation paths, `200`/`201`/`409` | `projects.service.create.db-spec.ts`, `projects.controller.create.e2e-spec.ts` | db, e2e |
| Projects: name and description rules | `project-dtos.spec.ts`, `projects.controller.validation.e2e-spec.ts` | unit, e2e |
| Projects: repository attach and change, `PROJECT_HAS_LINKS`, E62 | `projects.service.repository.db-spec.ts`, `projects.controller.manage.e2e-spec.ts`, `races/project-repository-change.race.db-spec.ts` | db, e2e, race |
| Projects: delete, tombstone, `unsentIssueCount` | `projects.service.delete.db-spec.ts` | db |
| Projects: no GitHub call and no job on creation | `projects.no-github.spec.ts` | unit |
| Projects: `404` for another user's or a deleted project; the single access check | `projects.routes.db-spec.ts`, `issues-routes.not-found.db-spec.ts`, `issues-access.spec.ts`, `issues-access.db-spec.ts` | db, unit |
| Projects: `openIssueCount` | `project-response.spec.ts`, `open-issue-count.db-spec.ts` | unit, db |
| [GitHub link](github-link.md#required-tests): import and attach, E61, `NULL` and `''` body | `issue-links.import.db-spec.ts`, `issue-links.attach.db-spec.ts` | db |
| GitHub link: refusals E3 and E57 to E60, gating | `issue-links.refusals.db-spec.ts` | db |
| GitHub link: duplicates E4, E45 to E47 | `issue-links.duplicates.db-spec.ts`, `races/link-unique.race.db-spec.ts` | db, race |
| GitHub link: unlink E63, E64; E62; attach and delete race | `issue-links.unlink.db-spec.ts`, `races/link-repository-change.race.db-spec.ts`, `races/attach-delete.race.db-spec.ts` | db, race |
| GitHub link: gone, moved, E22, E1, E44, `sync_failed` exits | `issues-sync.service.db-spec.ts`, `issues-sync.race.db-spec.ts` | db, race |
| GitHub link: rename and E65 redirect cases | Int. `github-issue-client.service.spec.ts`, `github-issue-redirect.spec.ts`, `github-issue-redirect.contract.spec.ts` | unit, contract |
| GitHub link: link object and `stale` | `issue-link-presenter.spec.ts`, `issue-link-presenter.db-spec.ts` | unit, db |
| [Sync](sync.md#required-tests): reconcile table, E6 to E9 | `issue-sync-merge.spec.ts`, `issues-sync.service.db-spec.ts` | unit, db |
| Sync: races E10, E13, E15, E41, commit guard E1, E32, E44 | `issues-sync.race.db-spec.ts` | race |
| Sync: triggers T1 to T6, E16, dedupe | `issues-sync.triggers.db-spec.ts`, `issues-sync.restart.db-spec.ts`, `issues-sync.bootstrap.spec.ts`, `issue-sync-triggers.service.spec.ts`, `issue-sync-queue.spec.ts` | db, unit |
| Sync: job mapping and real-engine specs | `issues-reconcile.job.spec.ts`, `issues-reconcile.engine.spec.ts` | unit, engine |
| Sync: guards, E24, `sync_failed` E18 to E22 | `issues-sync.service.db-spec.ts`, `issue-sync-triggers.service.spec.ts` | db, unit |
| Sync: rate limits, E17 | `issue-rate-limit-pauses.spec.ts`, `issues-sync.service.db-spec.ts` | unit, db |
| Sync: integration selection | `issue-candidates.spec.ts`, `issues-sync.service.db-spec.ts` ("candidate walk") | unit, db |
| Sync: staleness, the 60-second fresh skip | `issue-link-presenter.spec.ts`, `issue-links.sync-triggers.db-spec.ts` | unit, db |
| Sync: client `getIssue`, `updateIssue`, `probeIssues` | Int. `github-issue-client.service.spec.ts`, `integrations-github-issue-writer.service.spec.ts` | unit |
| [Security](security.md#required-tests): credential and content canaries, log checks | `issues-credential-canary.db-spec.ts`, `issues-content-canary.db-spec.ts`, `issues-unique-index.logging.db-spec.ts` | db |
| Security: `error.meta`, no internal id | `issues-routes.access-matrix.e2e-spec.ts`, `issues-credential-canary.db-spec.ts` | e2e, db |
| Security: static specs | `module-boundaries.spec.ts`, `no-sql-now.spec.ts`, `column-allowlist.spec.ts`, `sql-bound-parameters.spec.ts`, `eslint-boundary.spec.ts`, Int. `integrations-writer-boundary.spec.ts`, Int. `integrations-github-get-only.spec.ts` | static |
| Security: writer fields, off-host `Location`, token permission sets | Int. `integrations-github-issue-writer.service.spec.ts`, `github-issue-client.service.spec.ts`, `github-issue-redirect.contract.spec.ts`, `integrations-github.service.spec.ts`, `github-installation-token-cache.spec.ts` | unit, contract |
| Security: data at rest, job after deletion | `projects.service.delete.db-spec.ts`, `issues-sync.race.db-spec.ts` | db, race |
| Security: quotas and request rate limits | `projects.service.create.db-spec.ts`, `issues.service.create.db-spec.ts`, `issue-links.import.db-spec.ts`, `issue-links.rate-limit.db-spec.ts`, `issues.routes.db-spec.ts`, `issues-config.spec.ts`, `races/project-cap.race.db-spec.ts`, `races/issue-cap.race.db-spec.ts` | db, unit, race |
| Security: bulk weight boundary, E74 | `issue-edit-rate-limiter.spec.ts`, `issues.service.bulk-state.db-spec.ts` | unit, db |
| [Edge cases](edge-cases.md#required-tests): one test per row | See the E-id map below; `edge-cases.coverage.spec.ts` fails when an id is cited by no spec | static |
| [Testing](testing.md#required-tests): fidelity contract | Int. `integrations-github.contract.spec.ts` | unit |
| Testing: no-network guard | `installNoNetworkGuard()`, installed in the Integrations GitHub specs | unit |
| Testing: access matrix and completeness | `issues-routes.access-matrix.e2e-spec.ts` | e2e |
| Testing: cache-policy coverage | `core/tests/cache-policy.coverage.spec.ts` | static |
| Testing: job params, real-engine and restart specs | `issue-sync-queue.spec.ts`, `issues-sync.triggers.db-spec.ts`, `issues-reconcile.engine.spec.ts`, `issues-sync.restart.db-spec.ts` | unit, db, engine |
| [Routes](../../backend/routes/issues.md#required-tests): access matrix, no internal id | `issues-routes.access-matrix.e2e-spec.ts` | e2e |
| Routes: outcomes, listing, errors, the four #490 codes | `projects.controller.*.e2e-spec.ts`, `issues.controller.validation.e2e-spec.ts`, `issues-http-errors.spec.ts`, `projects.routes.db-spec.ts`, `issues.routes.db-spec.ts`, `issue-links.routes.db-spec.ts`, `issues.service.listing.db-spec.ts`, `projects.service.listing.db-spec.ts` | e2e, unit, db |
| Routes: link object, T2 to T4 | `issue-link-presenter.spec.ts`, `issue-links.controller.triggers.e2e-spec.ts`, `issue-links.sync-triggers.db-spec.ts` | unit, e2e, db |
| Routes: validation (code points, 4-byte case) | `*.controller.validation.e2e-spec.ts`, `issue-dtos.spec.ts`, `project-dtos.spec.ts` | e2e, unit |

### E-id map

| Edge cases | Spec files |
|---|---|
| E1 to E5, E10, E11, E13, E15, E17 to E24, E26, E27, E30, E32, E38, E40, E41, E44, E65 | `issues-sync.service.db-spec.ts`, `issues-sync.race.db-spec.ts` |
| E6 to E9 | `issue-sync-merge.spec.ts` |
| E12 | `issues.service.edit.db-spec.ts`, `issues.service.bulk-state.db-spec.ts` |
| E14, E16, E51 | `issues-sync.restart.db-spec.ts`, `issues-sync.triggers.db-spec.ts` |
| E28, E48, E62 | `projects.service.repository.db-spec.ts` and the race specs |
| E29, E37, E39 | `projects.routes.db-spec.ts` |
| E31, E53 | `user-deleted.listener.db-spec.ts` |
| E33, E49 | `projects.service.delete.db-spec.ts` |
| E34 to E36 | `races/project-create.race.db-spec.ts` |
| E42 | `races/issue-edit-marker.race.db-spec.ts` |
| E43 | `issues-sync.triggers.db-spec.ts` |
| E45 to E47 | `issues-tables.db-spec.ts`, `issue-links.duplicates.db-spec.ts`, `races/link-unique.race.db-spec.ts` |
| E50, E52, E54, E56 | `issues-tables.db-spec.ts`, `issues.service.edit.db-spec.ts` |
| E55 | `issues-sync.service.db-spec.ts` |
| E57 to E60 | `issue-links.refusals.db-spec.ts` |
| E61, E63, E64 | `issue-links.attach.db-spec.ts`, `issue-links.unlink.db-spec.ts` |
| E66 to E69 | `races/bulk-state.race.db-spec.ts` |
| E70 to E72, E74 | `issues.service.bulk-state.db-spec.ts` |
| E73 | `open-issue-count.db-spec.ts` |
| E25 | Allowlisted: the future "remove repository" feature is not built |

**Tier note.** [Edge cases](edge-cases.md#required-tests) lists E1 to E3, E5, E11, E17 to E24, E27, E28 and E57 to E61 as unit rows. Their service-level tests run in the DB-backed tier with the fake GitHub client, which is the stricter tier. Unit specs cover the pieces under them: the merge, the candidates, the pauses, the job and the Integrations client classification. No duplicate unit test was added.

## Frontend

| Section | Covered by |
|---|---|
| [Frontend](frontend.md#required-tests): routes | `utils/routing/HashRouteResolverSpec.js`, `components/common/header/helpers/HeaderHelperSpec.js` |
| Frontend: creation | `projects/pages/new/ProjectNewControllerSpec.js`, `ProjectNewHelperSpec.js`, `projects/pages/ProjectNewSpec.js`, `projects/repositoryPicker/RepositoryPickerControllerSpec.js`, `RepositoryPickerHelperSpec.js`, `projects/errors/errorMessagesSpec.js`, `client/ProjectsClientSpec.js`, `utils/validation/projectValidatorsSpec.js` |
| Frontend: project management | `projects/pages/edit/ProjectDetailsControllerSpec.js`, `ProjectRepositoryControllerSpec.js`, `ProjectRepositoryHelperSpec.js`, `ProjectDeleteControllerSpec.js`, `ProjectDangerHelperSpec.js`, `components/common/confirmModal/controllers/ConfirmModalControllerSpec.js` |
| Frontend: lists | `projects/pages/list/controllers/ProjectsControllerSpec.js`, `ProjectsControllerHashSpec.js`, `projects/listQuerySpec.js`, `issues/list/controllers/IssuesControllerSpec.js`, `IssuesControllerNavigationSpec.js`, `issues/list/helpers/IssueLinkCellHelperSpec.js`, `IssuesTableHelperSpec.js`, `ProjectsTableHelperSpec.js` |
| Frontend: issue page and forms | `issues/pages/show/IssueActionsControllerSpec.js`, `issues/pages/form/IssueFieldsHelperSpec.js`, `IssueFormControllerSpec.js`, `IssueFormHelperSpec.js`, `utils/validation/issueValidatorsSpec.js` |
| Frontend: linking | `issues/link/issueNumberInputSpec.js`, `issues/link/modals/ImportIssueControllerSpec.js`, `AttachIssueControllerSpec.js`, `attachWarningSpec.js`, `issues/link/LinkPanelControllerUnlinkSpec.js` |
| Frontend: states | `issues/link/linkStatePresenterSpec.js`, `LinkStateBadgeSpec.js`, `LinkPanelHelperSpec.js`, `projects/pages/show/ProjectHeaderHelperSpec.js`, `projects/errors/errorMessagesSpec.js` |
| Frontend: re-reading | `issues/sync/BoundedRereadControllerSpec.js`, `FocusRereadThrottleSpec.js`, `issues/pages/show/useSavedIssueRereadSpec.js`, `IssueActionsControllerSpec.js`, `issues/link/LinkPanelControllerSpec.js`, `projects/pages/show/ProjectRefreshControllerSpec.js` |
| Frontend: empty, loading and error states | `issues/pages/common/IssueLoadControllerSpec.js`, `projects/pages/common/ProjectLoadControllerSpec.js`, `issues/list/helpers/IssuesEmptyStateHelperSpec.js`, `projects/pages/list/helpers/ProjectsEmptyStateHelperSpec.js`, `projects/errors/errorMessagesSpec.js`, `client/ApiErrorSpec.js`, `utils/validation/fieldValidatorsSpec.js`, `formValidatorsSpec.js` |
| Frontend: `ConfirmModal` | `components/common/confirmModal/helpers/ConfirmModalHelperSpec.js`, `ConfirmModalControllerSpec.js`, `ConfirmModalSpec.js` |
| Frontend: U1 to U11 | U1 `IssueLoadControllerSpec`, `ProjectLoadControllerSpec`; U3 `AttachIssueControllerSpec`; U5 `IssuesControllerNavigationSpec`, `ProjectsControllerSpec`; U6 `IssuesControllerSpec`, `ProjectsControllerHashSpec`, `listQuerySpec`; U7 `linkStatePresenterSpec`; U9 `ConfirmModalControllerSpec`, `ProjectDangerHelperSpec`; U10 `IssueFormControllerSpec`, `IssueChangedBannerSpec`, `FocusRereadThrottleSpec`; U11 `components/common/forms/controllers/DirtyFormGuardControllerSpec.js`, `issues/pages/form/useIssueFormSpec.js` |
| Frontend: security S1 to S5, P5 | `issues/securityStaticSpec.js`, `projects/securityStaticSpec.js`, `issues/link/GithubLinkSpec.js`, `LinkPanelHelperSpec.js`, `client/IssuesClientPathIdsSpec.js`, `projects/pathsSpec.js`, `utils/ids/uuidSpec.js`, `issues/body/IssueBodySpec.js` |
| Frontend: counts and bulk (#563) | `projects/pages/list/helpers/ProjectsTableHelperSpec.js`, `issues/list/controllers/BulkSelectionControllerSpec.js`, `issues/list/helpers/IssuesBulkBarHelperSpec.js`, `IssuesControllerSpec.js`, `client/IssuesClientBulkSpec.js` |
| [Security](security.md#required-tests), frontend rows: the `IssueBody` rendering table | `issues/body/IssueBodyMarkdownSpec.js`, `IssueBodyPlainSpec.js`, `IssueBodySpec.js` |
| Security, frontend rows: static checks and the link `url` check | `issues/securityStaticSpec.js`, `projects/securityStaticSpec.js`, `issues/link/GithubLinkSpec.js`, `LinkPanelHelperSpec.js`, `linkStatePresenterSpec.js` |
