# Infra — Workflow

The CircleCI workflow graph, its filters and ordering. Part of the [infra architecture hub](../infra.md).

## Workflow

All test/lint jobs run on every push. The release chain (`build-and-release`, `release-kerghan`,
`release-kerghan-standalone`, `release-kerghan-assets`, the `upload_*` jobs, and `release`) is gated to **semver tag pushes only**, via the shared `tags_only` filter
(`tags: { only: /\d+\.\d+\.\d+/ }`, `branches: { ignore: /.*/ }`). The `release-image` jobs
(the 4 base-image publishes) have no branch filter at all — CircleCI schedules them on every
push, but `bin/image.sh`'s `skip_if_not_tag` guard makes them a fast no-op unless the push is a
tag, and `skip_if_unchanged` makes even tag builds a no-op when neither `dockerfiles/base/` nor
`bin/image.sh` has changed since the last release (see "Shared base Dockerfile" below).

```
release-circleci_kerghan-base(-arm64) ─┬─ backend_tests ──┐
                                        ├─ backend_db_tests┤
                                        └─ backend_checks ─┤
                                          jasmine ─────────┼─ build-and-release ─────────────────┐
                                    frontend-checks ───────┤                                      │
                              proxy_extension_tests ───────┤                                      │
                                      scripts_tests ───────┤                                      │
                                     release-kerghan ──────┘                                      │
                                                            ├─ upload_proxy_files ─┬─ upload_extension ──────┐
                                                            │                      └─ copy_proxy_configuration┤
                                                            └─ upload_fe_files ─────────────────────────────┼─ release
                              release-vite_kerghan-base(-arm64) ───────────────────────────────────────────┘

backend_tests ─┬─ coverage-final   (side branch off the same jobs, not part of the release chain)
jasmine ───────┘

release-kerghan-base(-arm64)  — published for local/dev use; nothing in this workflow requires it

backend_tests, backend_db_tests, backend_checks, jasmine, frontend-checks, proxy_extension_tests ──┐
                                                 release-production_kerghan-base(-arm64) ──────────┴─ release-kerghan ─┬─ release-kerghan-standalone ─ release-kerghan-assets
                                                                                                                         └─ build-and-release (above)
```

The six boxes feeding `build-and-release`/`upload_proxy_files`/`upload_fe_files`
(`backend_tests`, `backend_db_tests`, `backend_checks`, `jasmine`, `frontend-checks`,
`proxy_extension_tests`) are each required directly by all three of those jobs (and by
`release-kerghan`) — the diagram only draws the edges once to
stay readable. `scripts_tests` and `release-kerghan` are required only by `build-and-release`. `coverage-final` requires only `backend_tests` and `jasmine` (the two jobs that
upload partial Codacy coverage) and isn't required by anything else — it doesn't gate the release
chain, it just finalizes the aggregated Codacy report once both partial uploads have completed.

All three Codacy upload steps (the partial uploads in `backend_tests`/`jasmine`, and the
finalize step in `coverage-final`) are best-effort/non-blocking (`|| true` on the upload
command): `CODACY_PROJECT_TOKEN` isn't provisioned in CircleCI's project settings yet, so as
things stand today the uploader always fails with "Invalid configuration: Either a project or
account API token must be provided". Making the step non-blocking keeps that missing credential
from failing `backend_tests`/`jasmine` themselves — which would otherwise incorrectly gate
`build-and-release` on an unrelated external-service token — while still actually attempting the
upload every run, so real Codacy reporting resumes automatically, with no further config change,
once the token is provisioned. The test/lint commands earlier in each job remain the real
pass/fail gate.

### `.codacy.yml` — suppressing confirmed static-analysis false positives

Separate from the CircleCI coverage upload above, Codacy's GitHub App also runs its own static
analysis directly against every PR (the "Codacy Static Code Analysis" check-run), gating on zero
new issues of at least minor severity. `.codacy.yml` (repo root) is Codacy's own supported,
version-controlled configuration file for narrowly excluding specific tool/path combinations from
that analysis — introduced in PR #33 (issue #30) to resolve a real block: PMD's ecmascript module
misparses this codebase's private class methods/fields (`static async #method() {}`) as a
redundant "Unnecessary block", flagging the method body itself. Confirmed as a PMD parser
limitation with this JS syntax, not a real code smell, this is scoped to only the three files that
use private methods heavily (`ApiClient.js`, `AccountsClient.js`, `HeaderController.js`) via
`engines.pmd.exclude_paths`, rather than disabling PMD (or any rule) repository-wide. Other
confirmed false positives from that same PR (Codacy's `xss/no-mixed-html` firing on
`renderToStaticMarkup`-based Jasmine spec assertions, and `security/detect-object-injection`
firing on bracket-notation access with a compile-time-fixed key) were resolved with narrower,
per-line `// eslint-disable-next-line <rule>` comments instead, since Codacy's ESLint-based tool
respects native ESLint inline-disable syntax — `.codacy.yml` was reserved for PMD, which has no
such per-line mechanism available here. Future Codacy findings should default to the same
per-line-inline-disable approach when the underlying tool supports it, falling back to a
narrowly-scoped `.codacy.yml` `exclude_paths` entry (documented inline, same as above) only when
it doesn't.

### Why `build-and-release` requires `release-kerghan`

`build-and-release` deploys the release to Render (#341, #362): Render builds the thin
`dockerfiles/production_kerghan/Dockerfile`, which is only `FROM darthjee/kerghan:<CIRCLE_TAG>`.
That tag only exists once `release-kerghan` has pushed it, so `build-and-release` requires
`release-kerghan`. Render no longer builds the full image itself (that is
`dockerfiles/release_kerghan/Dockerfile`, built by `release-kerghan`), so `build-and-release` no
longer needs a direct dependency on `release-production_kerghan-base(-arm64)` (added by #17 when
Render built from `:latest`): `release-kerghan` already requires those jobs to pin its base image,
so the ordering holds transitively. It also requires `scripts_tests`, the bats suite for the deploy scripts. The
same pattern exists for `upload_fe_files`, which requires `release-vite_kerghan-base(-arm64)`.

`release` (the final atomic-swap job) does not need its own direct dependency on
`release-kerghan` or the production-base jobs — it already requires `build-and-release`, and CircleCI only starts a job
once everything in its `requires` list has finished successfully, so the ordering guarantee
holds transitively.

`release-kerghan-base(-arm64)` and `release-circleci_kerghan-base(-arm64)` don't need a direct
`build-and-release`/`release` dependency either: `release-circleci_kerghan-base(-arm64)` is
already required by `backend_tests`/`backend_db_tests`/`backend_checks`, all of which run before
`build-and-release`/`release` in the graph, so they're safely ordered transitively too.
`release-kerghan-base(-arm64)` (the dev-only base image) isn't required by anything in this
workflow at all — nothing downstream depends on it being fresh.

