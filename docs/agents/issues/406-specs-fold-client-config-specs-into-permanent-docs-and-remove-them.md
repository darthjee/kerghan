# Issue: Specs: fold client config specs into permanent docs and remove them

## Description

Last sub-issue of the client config Epic (#402). Depends on every other sub-issue of #402
(specs #403, `kerghan configure` #404, `kerghan wizard` #405), all merged.

Following the lifecycle in `docs/agents/specs.md`, move the lasting content of
`docs/agents/specs/client-config/` (`README.md`, `files.md`, `configure.md`, `wizard.md`,
`security.md`) into the permanent docs, then delete the spec folder. Docs-only change, owned
by the architect. Precedent: #394 (user approval), which folded its specs into a dedicated
sub-doc linked from the main doc.

## Problem

While the spec is active, `kerghan configure` and `kerghan wizard` are defined only in
`docs/agents/specs/client-config/`. Deleting the folder before folding it would lose the
rules (key routing, write rules, edge cases, secret handling) that the client now implements.

The spec is about 765 lines and `docs/agents/standalone.md` is already about 612, so inlining
everything there would make the standalone doc hard to navigate.

## Expected Behavior

- Every lasting decision in the spec is in a permanent doc; nothing is lost.
- A new sub-doc, `docs/agents/standalone/client-config.md`, documents the shared config/env
  file write rules, `kerghan configure`, `kerghan wizard` and the security rules.
- Each folded rule set keeps a condensed "Required tests" section next to the rules it
  verifies, so later changes still know what the bats suite must cover.
- `docs/agents/standalone.md` gets a short section for `configure` / `wizard` (next to the
  existing `auto-login`, `bind` and `update-env` ones) that summarizes them and links to the
  sub-doc.
- `README.md` "Run Kerghan standalone" mentions `kerghan configure` / `kerghan wizard` as the
  way to change settings.
- `standalone/config.example` points to `kerghan configure` / `kerghan wizard` as an
  alternative to hand-editing.
- `docs/agents/specs/client-config/` is deleted and no link points to it anymore.
- `docs/agents/specs.md` moves the entry from "Active specs" to "Completed specs", pointing at
  the permanent docs, with product decision #402; "Active specs" reads "none".

## Solution

- Create `docs/agents/standalone/client-config.md` from `files.md`, `configure.md`,
  `wizard.md` and `security.md` (plus the lasting parts of the spec `README.md`: scope,
  exit codes and streams), keeping condensed "Required tests" sections.
- Add the short summary + link section to `docs/agents/standalone.md`.
- Update `README.md` and `standalone/config.example` as above.
- Check that the client `usage` text matches the folded docs.
- Delete the spec folder and update `docs/agents/specs.md`.
- Grep for any remaining `specs/client-config` link and fix it.
