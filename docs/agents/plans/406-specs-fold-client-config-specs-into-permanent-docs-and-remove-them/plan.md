# Plan: Specs: fold client config specs into permanent docs and remove them

Issue: [406-specs-fold-client-config-specs-into-permanent-docs-and-remove-them.md](../../issues/406-specs-fold-client-config-specs-into-permanent-docs-and-remove-them.md)

## Overview

Close the client config spec lifecycle (Epic #402). Fold the lasting content of
`docs/agents/specs/client-config/` into a new permanent sub-doc,
`docs/agents/standalone/client-config.md`, and link it from `docs/agents/standalone.md`. Add
pointers to `kerghan configure` / `kerghan wizard` in the user-facing docs, repoint every
reference to the spec folder, then delete the folder and move the entry to "Completed specs".

## Context

- `kerghan configure` (#404) and `kerghan wizard` (#405) are merged, so the spec is final.
- The spec has about 765 lines in five files (`README.md`, `files.md`, `configure.md`,
  `wizard.md`, `security.md`). `docs/agents/standalone.md` already has 612 lines, so the user
  chose a sub-doc, following the #394 precedent (`modules/auth/user-approval.md`).
- The user chose to keep the "Required tests" sections, condensed, next to the rules they
  verify.
- The client `usage` text in `standalone/bin/kerghan` already lists both commands. The
  `standalone.md` command block does not list them yet.
- Code comments still point at the spec folder: `standalone/bin/kerghan` (around lines 517 and
  1851) and the headers of `standalone/test/configure.bats`, `configure_files.bats`,
  `configure_security.bats` and `wizard.bats`.

## Steps

- [01 — Create the client-config sub-doc](plan/01-create-client-config-sub-doc.md)
- [02 — Link it from standalone.md](plan/02-update-standalone-md.md)
- [03 — Update user-facing and index docs](plan/03-update-user-facing-docs.md)
- [04 — Repoint code and test comments](plan/04-repoint-code-comments.md)
- [05 — Delete the spec folder and complete the spec entry](plan/05-delete-spec-folder.md)

## CI Checks

- `standalone/`: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`). Only
  comments change there, but run it to confirm nothing broke.

## Notes

- Docs-only change, owned by the architect, as the issue says. The only edits under
  `standalone/` are comment lines and the `config.example` header, so there is no separate
  `standalone` agent plan.
- Do not copy the spec's "Sub-issue map" or "Alternatives rejected" sections word for word.
  Keep the rejected alternatives only as short design notes ("why `key=value`", "why no
  `--env`", "why write-only") where they explain a rule.
- Drop links to the spec folder from the folded text; rewrite them as anchors inside the new
  sub-doc.
