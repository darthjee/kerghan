# Consistency checks and reviews

Run the issue's Verification checks and fix anything they find.

- **Markers:** under `docs/agents/specs/repos/`, nothing matches:
  - `grep -rn "#450" docs/agents/specs/repos/`, outside the README's sub-issues table, order
    line and decisions links;
  - `grep -rn "settled by #450\|#450 may\|#450's"`.
- **Replaced sentences:** none of these match any more:
  - `grep -rn "nothing past the cap is deleted\|returned it in their latest sync\|for now; #450"`.
- **New terms present in every listed file:**
  - `not_found` (`model.md`, `sync.md`, `integrations.md`, `api.md`, `ui.md`);
  - `missing` (`integrations.md`, `sync.md`);
  - `REPOSITORY_SOURCE_UNUSABLE` (`api.md`, `integrations.md`, `ui.md`, README);
  - `secret_iv` (`integrations.md`, `security.md`);
  - `user.deleted` (`model.md`, `integrations.md`, README).
- **Links:** every `](file.md#anchor)` in the changed files resolves to an existing heading.
  Check with a grep of the link targets against each file's headings, slugified the
  GitHub way.
- **Coverage:** each row of the issue's "Rule changes at a glance" table has a "Required tests"
  entry in its owning file. Each scenario test is in `edge-cases.md#required-tests`.
- **Diff scope:** only `docs/agents/specs/repos/*.md` changed (`git diff --stat origin/main`,
  besides the issue and plan files).
- **Reviews**, all read-only; address their findings:
  - `security`: the `409` disclosure, the `secret_iv` boundary, user deletion retention, the link
    fill;
  - `data-access`: user scoping of the new statements (link fill, past-cap trim, `user.deleted`,
    the conditional Add, the tie-break);
  - `product-owner`: the edge-case outcomes vs #444's product rules (re-link exclusion, private
    metadata lifecycle).

## Files to Change

- Any file under `docs/agents/specs/repos/` that a check or review shows needs a fix.
