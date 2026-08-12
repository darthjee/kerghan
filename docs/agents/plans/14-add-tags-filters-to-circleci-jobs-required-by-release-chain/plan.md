# Plan: Add tags filters to CircleCI jobs required by release chain

Issue: [14-add-tags-filters-to-circleci-jobs-required-by-release-chain.md](../../issues/14-add-tags-filters-to-circleci-jobs-required-by-release-chain.md)

## Overview

Add a new shared `filters` anchor to `.circleci/config.yml` (mirroring Majora's `*all_tags`
pattern) and apply it to the five jobs the release chain `requires` but that currently have no
`filters` block at all (`backend_tests`, `backend_checks`, `jasmine`, `frontend-checks`,
`proxy_extension_tests`). Without it, CircleCI's default (no `filters` = branches only) skips
these jobs on tag pushes, so `build-and-release`/`upload_proxy_files`/`upload_fe_files` can never
resolve their `requires` and the whole release/deploy chain silently never fires on a tag. This
is entirely within the `infra` agent's scope (`.circleci/config.yml` only) — no other agent has
work here.

## Context

`.circleci/config.yml`'s release chain (`build-and-release`, `upload_proxy_files`,
`upload_fe_files`, and everything downstream — `upload_extension`, `copy_proxy_configuration`,
`release`) is gated to semver tag pushes only, via the existing `filters: &tags_only` anchor
(`tags: only: /\d+\.\d+\.\d+/`, `branches: ignore: /.*/`). Each of these jobs `requires`
`backend_tests`, `backend_checks`, `jasmine`, and `frontend-checks`, and
`build-and-release`/`upload_proxy_files`/`upload_fe_files` additionally require
`proxy_extension_tests` — none of which currently declare any `filters` block, so they're
implicitly branches-only and get skipped on a tag push.

`docs/agents/architecture/infra.md` already documents the *intended* design as "All test/lint
jobs run on every push" — this plan makes the actual config match that already-documented
intent, so that doc needs no content changes, only its "Filter" column values for these five
jobs become true.

## Implementation Steps

### Step 1 — Add the `&all_tags` anchor

In `.circleci/config.yml`, next to the existing `filters: &tags_only` anchor definition (on the
`build-and-release` job), add a new anchor:

```yaml
filters: &all_tags
  tags:
    only: /.*/
```

No `branches` key — CircleCI implicitly defaults an omitted `branches` key to
`only: /.*/`, so this preserves unchanged branch-push behavior while adding tag-push coverage.
This mirrors Majora's `*all_tags` pattern exactly.

### Step 2 — Apply the anchor to the five prerequisite jobs

In the `test` workflow's `jobs` list, add `filters: *all_tags` to:
- `backend_tests`
- `backend_checks`
- `jasmine`
- `frontend-checks`
- `proxy_extension_tests`

None of these currently have a `filters` key, so this is a pure addition, not a merge with
existing filter config.

### Step 3 — Verify the tag-only chain is untouched

Confirm `&tags_only` and its usages (`build-and-release`, `upload_proxy_files`,
`upload_fe_files`, `upload_extension`, `copy_proxy_configuration`, `release`) are unchanged —
this step is a diff review, not a code change. Also confirm the 8 `release-image` invocations
(which already use inline `filters: { tags: { only: /.*/ } }`) are left as-is — out of scope per
the issue's "Scope boundaries" section; do not refactor them onto the new anchor.

### Step 4 — Validate the config

Run `circleci config validate` locally (or via CircleCI's config-validation API if the CLI isn't
installed) against `.circleci/config.yml` to confirm the YAML is well-formed and the new anchor
resolves correctly before pushing.

## Files to Change

- `.circleci/config.yml` — add `&all_tags` anchor; apply `filters: *all_tags` to `backend_tests`,
  `backend_checks`, `jasmine`, `frontend-checks`, `proxy_extension_tests`.

## CI Checks

- `.circleci`: `circleci config validate` — local static validation of the YAML/anchor
  correctness; there is no dedicated CircleCI job that lints its own config, so this is a
  pre-push sanity check rather than a pipeline job.

## Notes

- No job `steps`, `docker` images, or `working_directory` changes — this is a workflow-level
  `filters` change only.
- The `&all_tags` anchor intentionally matches any tag (`/.*/`), not just semver tags like
  `&tags_only` — a non-semver tag push will still trigger these five jobs even though it can't
  reach the release chain (still gated behind `&tags_only`'s semver match). Accepted as a minor,
  self-correcting cost (wasted CI minutes, not a correctness issue) — see the issue's "Edge
  cases" section for the full rationale.
- End-to-end verification that the release chain actually fires on a tag push can only be
  confirmed by watching a real tag-triggered CircleCI workflow (e.g. after merge, on the next
  release tag) — there's no way to simulate CircleCI's tag-trigger behavior locally beyond
  `circleci config validate`.
