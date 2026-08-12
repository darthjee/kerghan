# Issue: Add tags filters to CircleCI jobs required by release chain

## Description

`.circleci/config.yml`'s release chain (`build-and-release`, `upload_proxy_files`, and
`upload_fe_files`) is gated to tag pushes only, via a shared `filters: &tags_only` anchor
(`tags: only: /\d+\.\d+\.\d+/`, `branches: ignore: /.*/`). Each of these jobs `requires`
`backend_tests`, `backend_checks`, `jasmine`, and `frontend-checks`, and
`build-and-release`/`upload_proxy_files`/`upload_fe_files` additionally require
`proxy_extension_tests`.

Majora's `config.yml` avoids the problem below by applying a shared `filters: *all_tags` anchor
(`tags: only: /.*/`) to all of its equivalent jobs (`pytest_*`, `jasmine`, `checks`,
`frontend-checks`, `proxy_extension_tests`), ensuring they run on both branch and tag pushes so
that tag-gated jobs further down the workflow can find their dependencies satisfied.

## Problem

None of `backend_tests`, `backend_checks`, `jasmine`, `frontend-checks`, or
`proxy_extension_tests` currently declare a `filters` block. By CircleCI's default behavior, a
job without a `filters` block only runs on branch pushes — it is skipped entirely on tag pushes.

Since the release jobs `require` these unfiltered jobs, on a tag push those required jobs never
run, and CircleCI never satisfies the `requires` dependency. This means `build-and-release`,
`upload_proxy_files`, and `upload_fe_files` — and everything downstream of them
(`upload_extension`, `copy_proxy_configuration`, `release`) — likely never trigger on a tag push,
breaking the entire release/deploy chain.

## Expected Behavior

- `backend_tests`, `backend_checks`, `jasmine`, `frontend-checks`, and `proxy_extension_tests`
  all declare a `filters` block that permits execution on tag pushes (any tag), not just branch
  pushes.
- `build-and-release`, `upload_proxy_files`, and `upload_fe_files` can resolve their `requires`
  dependencies on a tag push (i.e. the jobs they depend on actually ran in that same workflow).
- Existing branch-push behavior for `backend_tests`, `backend_checks`, `jasmine`,
  `frontend-checks`, and `proxy_extension_tests` is unchanged — they still run on every branch
  push as before.
- The tag-only filters on `build-and-release`, `upload_proxy_files`, `upload_fe_files`,
  `upload_extension`, `copy_proxy_configuration`, and `release` remain unchanged (still gated to
  semver tags only).

## Solution

- CircleCI (`.circleci/config.yml`):
  - Add a reusable `filters` anchor equivalent to Majora's `*all_tags` pattern (e.g.
    `&all_tags`, `tags: only: /.*/`, with no `branches` key — CircleCI implicitly defaults an
    omitted `branches` key to `only: /.*/`, so this preserves unchanged branch-push behavior
    while adding tag-push coverage).
  - Apply that anchor to the `backend_tests`, `backend_checks`, `jasmine`, `frontend-checks`,
    and `proxy_extension_tests` job invocations in the `test` workflow.
  - Verify the existing `tags_only` anchor (used by `build-and-release`, `upload_proxy_files`,
    `upload_fe_files`, `upload_extension`, `copy_proxy_configuration`, and `release`) is left
    unchanged — those jobs should remain tag-only, they just now need their prerequisite jobs to
    actually run on tag pushes too.

### Scope boundaries

This issue is limited to fixing the broken `requires` dependency chain on tag pushes. It does
**not** touch:

- The 8 `release-image` job invocations. They already declare working, correct tag filters
  (`filters: { tags: { only: /.*/ } }`), just written inline instead of via a shared anchor —
  even though the new `&all_tags` anchor introduced here follows the exact same pattern. Folding
  those into the new anchor as a DRY cleanup was considered and deliberately deferred to a
  separate follow-up issue, to keep this fix narrowly scoped to the actual dependency-chain bug
  rather than also reviewing 8 already-correct jobs.
- Job `steps`, `docker` images, or `working_directory` — this is a workflow-level `filters`
  change only, no job-behavior change.
- Majora's `config.yml` — this issue only ports Majora's `*all_tags` pattern into Kerghan; Majora
  itself is not modified.

### Edge cases

- **Tag pattern breadth.** `&all_tags` uses `/.*/` (any tag), matching Majora's `*all_tags`
  pattern exactly, rather than being restricted to the same semver pattern as `tags_only`. This
  means a non-semver tag push will still trigger `backend_tests`/`backend_checks`/`jasmine`/
  `frontend-checks`/`proxy_extension_tests` even though it can't reach the release chain (those
  jobs stay gated behind `tags_only`'s semver match) — accepted as a minor, self-correcting cost
  (wasted CI minutes, not a correctness issue) in exchange for not having two tag regexes that
  must be kept in sync.
- **Filter-omission semantics.** A job with no `filters` block at all defaults to branches-only
  (tags excluded) — that's the current bug. A `filters` block that declares `tags` but omits
  `branches`, however, does *not* mean "no branches": CircleCI implicitly fills in
  `branches: {only: /.*/}`. So `&all_tags` only needs a `tags:` key — no `branches:` key — to
  achieve "unchanged branch behavior + also runs on these tags." Implementers should not
  defensively add a `branches: {only: /.*/}` entry.
- **Duplicate runs on tag-after-branch pushes.** Tagging a commit that was already tested via a
  branch push causes CircleCI to re-run `backend_tests`/`backend_checks`/`jasmine`/
  `frontend-checks`/`proxy_extension_tests` from scratch in the new tag-triggered workflow — a
  job's prior success on the branch workflow does not carry over. This is expected and
  necessary (the release jobs need their prerequisites satisfied *within the same workflow run*),
  not an oversight.

## Benefits

Restores the full release/deploy chain (`build-and-release`, `upload_proxy_files`,
`upload_fe_files`, `upload_extension`, `copy_proxy_configuration`, `release`) on tag pushes,
without changing any existing branch-push CI behavior.
