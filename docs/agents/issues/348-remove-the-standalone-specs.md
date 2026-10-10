# Issue: Remove the standalone specs

## Description

Last sub-issue of epic #336. Delete the temporary standalone specs (`docs/agents/specs/standalone/`)
now that their lasting content lives in the permanent docs (#347), and record the feature as
completed in the specs hub, following the hub's lifecycle step 4 (`docs/agents/specs.md`).

**Owner:** architect

## Problem

`docs/agents/specs/standalone/` was a temporary source of truth for the epic's sub-issues. #347
folded it into the permanent docs, so keeping the folder leaves two competing definitions of the
same feature, and the hub still lists it under **Active specs**.

## Expected Behavior

- `docs/agents/specs/standalone/` no longer exists.
- The specs hub lists "Standalone distribution" under **Completed specs**, pointing at the
  permanent docs, and **Active specs** reads "none" (if nothing else is active).
- `grep -rn "specs/standalone" docs .claude AGENTS.md CLAUDE.md README.md` finds nothing outside
  the hub's Completed specs table, excluding historical files under `docs/agents/issues/` and
  `docs/agents/plans/`.

## Solution

- Delete `docs/agents/specs/standalone/` (`README.md`, `client.md`, `config.md`, `images.md`,
  `installer.md`, `render.md`, `stack.md`, `variables.md`).
- In `docs/agents/specs.md`, remove the "Standalone distribution" entry from **Active specs**
  (leaving "none") and add this row to **Completed specs**:

  | Feature | Now defined in | Product decision |
  |---|---|---|
  | Standalone distribution | [standalone.md](standalone.md); `README.md` "Run Kerghan standalone"; [environment-variables.md](environment-variables.md) "Standalone"; [architecture/infra.md](architecture/infra.md) (release jobs, Render image deploy); [folder-structure.md](folder-structure.md) | #336 |

- Agents and root instruction files link only to the hub; a grep at planning time found no other
  link to the folder, so no agent file should change. Remove any direct link that slipped in.

## Depends on

- #347 (permanent docs) — merged.
- #341 (Deploy Render from the `darthjee/kerghan` image) — still open. Its decisions live only in
  `specs/standalone/render.md`, and its own scope rewrites the Render deploy section of
  `architecture/infra.md`. #348 must run after #341 merges. Before deleting the folder, check that
  `infra.md` describes the image-based deploy (deploy by `imageUrl`, no deploy-branch update,
  `build-and-release` requires `release-kerghan`, rollback by redeploying an older tag) and no
  longer says "#341 will…".
