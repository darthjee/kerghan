# Consistency check and agent review

- `grep -rn "settled by #446" docs/agents/specs/repos/` returns nothing; every remaining marker
  has a README table row and vice versa.
- `grep -n "GET" docs/agents/specs/repos/*.md`: no repositories route is described as `GET`
  (GitHub-side `GET` calls are fine).
- Values are identical everywhere they appear (route paths, `perPage` 50/100, `search` 100,
  30 Adds / 60 s and env names, error codes and messages, status enums).
- All relative links and anchors resolve.
- Scope: `git diff --stat origin/main` shows only `docs/agents/specs/repos/*` (plus the issue and
  plan files).
- Read-only review by the repo agents named in the issue: `product-owner`, `security`,
  `data-access`, and `cache` (cache class / `X-Skip-Cache` on all four routes). Fold their
  findings into the spec files before opening the PR.

## Files to Change
- `docs/agents/specs/repos/*.md` — fixes from the check and the reviews only.
