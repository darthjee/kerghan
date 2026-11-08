# Consistency check and agent review

- `grep -rn "settled by #447\|#447's" docs/agents/specs/repos/` returns nothing; every remaining
  marker has a README row and vice versa.
- `grep -n "Link" docs/agents/specs/repos/*.md`: no text still says pagination follows `Link`
  URLs.
- Values are identical everywhere (1 h, 5 min, 10 × 100, ≤ 10, 10 s, 3, 2 min, 5 min, 2 s; env
  names; table and column names; `last_started_at` as the cooldown anchor).
- All relative links and anchors resolve.
- Scope: `git diff --stat origin/main` shows only `docs/agents/specs/repos/*` (plus the issue and
  plan files).
- Read-only review by repo agents: `backend` (schema and transaction feasibility on
  TypeORM/MySQL: `bigint` mapping, `ON DUPLICATE KEY`, insert-ignore), `security` (lease/run_id
  guards, fixed base URL, budget tracker), `data-access` (every query scoped by `user_id`; no
  cross-user page/status rows) and `product-owner`. Fold their findings into the spec files
  before opening the PR.

## Files to Change
- `docs/agents/specs/repos/*.md` — fixes from the check and the reviews only.
