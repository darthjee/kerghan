# Plan: Specs: fold the autocomplete specs into the permanent docs and remove them

Issue: [431-specs-fold-the-autocomplete-specs-into-the-permanent-docs-and-remove-them.md](../../issues/431-specs-fold-the-autocomplete-specs-into-the-permanent-docs-and-remove-them.md)

## Overview

Close the auto-complete Epic (#424) by following the spec lifecycle in `docs/agents/specs.md`:

- move every lasting decision from `docs/agents/specs/auto-complete/` into a new permanent page, `docs/agents/standalone/client-completion.md`, plus short updates to `standalone.md`, `contributing.md`, `client-update.md`, `folder-structure.md` and `README.md`;
- repoint the code comments that link into the spec folder (comment-only, no behaviour change);
- move the entry to "Completed specs" and delete the folder.

## Context

- The spec folder has six files (README, command, completion, install, contracts, security; about 1,270 lines).
- #429 and #430 shipped the code. #430 already reworded the `install.sh` header (`KERGHAN_COMPLETION` in Variables, exit rule narrowed to "any failure of the client or `vault` install").
- Precedents for folding specs: #406 (`client-config.md`) and #418 (`client-update.md`).
- Owner: the architect does everything, including the comment-only edits in `standalone/`, `dockerfiles/` and `.circleci/`. No specialist dispatch is needed.

## Steps

- [01 — Write client-completion.md](plan/01-client-completion-page.md)
- [02 — Update standalone.md and folder-structure.md](plan/02-standalone-and-folder-structure.md)
- [03 — Sync rule in contributing.md](plan/03-contributing-sync-rule.md)
- [04 — client-update.md installer interface and README](plan/04-client-update-and-readme.md)
- [05 — Repoint code comments](plan/05-repoint-code-comments.md)
- [06 — Complete the spec entry and delete the folder](plan/06-complete-spec-and-delete.md)

## CI Checks

- `standalone/`: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`)
- `standalone/test/completion*.bats` on bash 3.2: `docker-compose run --rm bats_bash32` (CI job: `standalone_completion_bash32`)

These must pass unchanged; the only code-file edits are comments.

## Notes

- **Fold, don't summarise.** Every rule, table, exact message and "Required tests" row from the spec files must survive in the new page. A reviewer should be able to diff the decision lists.
- **What to drop:** only spec scaffolding:
  - the sub-issue map and order;
  - "Open markers" (check first that no `> **Open — settled by` marker is left);
  - "Who reads what";
  - the "Out of scope here" notes about #429/#430;
  - wording such as "#430 builds it" or "#431 rewords".
  Rewrite those passages in the present tense ("the installer does …").
- **Links:** internal links between the spec files (`install.md#target`, `contracts.md#…`) become anchors in the one page. Links to `../../standalone/client-update.md` become `client-update.md`.
- **Test file headers:** test files cite spec labels (`matrix <row>`, `edge <n>`, `contract <name>`). Those labels must stay identical in the new page, so the README's grep-based coverage rule still works.
- **The final grep** (step 06) is the acceptance check: it must return nothing outside `docs/agents/issues/` and `docs/agents/plans/`.
