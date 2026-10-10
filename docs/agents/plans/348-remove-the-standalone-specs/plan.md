# Plan: Remove the standalone specs

Issue: [348-remove-the-standalone-specs.md](../../issues/348-remove-the-standalone-specs.md)

## Overview

Last sub-issue of epic #336. Delete the temporary standalone spec folder
`docs/agents/specs/standalone/` and record "Standalone distribution" as completed in the specs
hub (`docs/agents/specs.md`), following the hub's lifecycle step 4. The change is docs only and
owned by the architect.

## Context

#347 moved the lasting standalone content into the permanent docs (`docs/agents/standalone.md`,
`README.md` "Run Kerghan standalone", `environment-variables.md` "Standalone",
`architecture/infra.md`, `folder-structure.md`). One spec file still has no permanent home:
`render.md`, which holds the decisions for #341 (deploy Render from the `darthjee/kerghan`
image). #341 is still open and rewrites the Render deploy section of `architecture/infra.md` as
part of its own scope, so this issue runs only after #341 merges.

At planning time, the only link to `specs/standalone/` outside historical issue and plan files is
the hub's **Active specs** entry (`docs/agents/specs.md:48`).

## Implementation Steps

### Step 1 — Check that #341 is merged and its decisions are in `infra.md`

Confirm #341 is closed and merged, and that `docs/agents/architecture/infra.md` now covers every
decision in `docs/agents/specs/standalone/render.md`:

- `scripts/deploy.sh` deploys by `imageUrl` (`docker.io/darthjee/kerghan:<CIRCLE_TAG>`) and keeps
  polling `watch_deployment` until `live`;
- `update_deploy_branch` / `update_service_branch` are gone (including from the `scripts/`
  table in `infra.md`);
- deploys always use the version tag, never `latest`;
- `build-and-release` requires `release-kerghan`;
- rollback is a redeploy of the previous version tag.

`infra.md` must no longer say "#341 will…". If #341 is not merged, stop: deleting the folder
would remove #341's only source of truth. If something is missing, add it to `infra.md` before
going on, so that nothing in `render.md` is lost.

### Step 2 — Delete the spec folder and update the hub

- Delete `docs/agents/specs/standalone/` (`README.md`, `client.md`, `config.md`, `images.md`,
  `installer.md`, `render.md`, `stack.md`, `variables.md`).
- In `docs/agents/specs.md`, replace the "Standalone distribution" bullet under **Active specs**
  with `none` (keeping the "When no feature is in progress…" sentence), and append this row to
  the **Completed specs** table:

  ```markdown
  | Standalone distribution | [standalone.md](standalone.md); `README.md` "Run Kerghan standalone"; [environment-variables.md](environment-variables.md) "Standalone"; [architecture/infra.md](architecture/infra.md) (release jobs, Render image deploy); [folder-structure.md](folder-structure.md) | #336 |
  ```

- Run the acceptance grep and remove any direct link to the folder that slipped in:

  ```bash
  grep -rn "specs/standalone" docs .claude AGENTS.md CLAUDE.md README.md .circleci \
    | grep -v "docs/agents/issues/\|docs/agents/plans/"
  ```

  The only remaining hit should be in the hub's Completed specs table (or none, because the row
  links to the permanent docs, not to the folder).

## Files to Change

- `docs/agents/specs/standalone/` — deleted (8 files).
- `docs/agents/specs.md` — Active specs set to "none"; Completed specs row added.
- `docs/agents/architecture/infra.md` — only if Step 1 finds a `render.md` decision missing.

## Notes

- Do not touch `docs/agents/issues/` or `docs/agents/plans/`: they are historical and may keep
  linking to the deleted folder.
- `.circleci/config.yml:248` links to the hub (`docs/agents/specs.md`), not to the folder, so it
  needs no change.
- No CI job lints markdown, so there is no local check to run beyond the grep.
