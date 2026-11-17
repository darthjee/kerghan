# Plan: Revise the Issues GitHub link spec: addressing, gone guard and confirmations

Issue: [501-revise-the-issues-github-link-spec-addressing-gone-guard-and-confirmations.md](../../issues/501-revise-the-issues-github-link-spec-addressing-gone-guard-and-confirmations.md)

## Overview
Documentation-only follow-up to #487 (merged in #500). Rewrite the rules of `docs/agents/specs/issues/github-link.md` that the later design dialogue replaced (owner/name addressing with `Location`-classified redirects, the issues-list probe guarding `gone`, the `sync_failed` exit rules without `paused`, the GitHub read outside the transaction, the `updated_at`-bound attach confirmation, the normalization invariant and the unlinking refinements), then bring `edge-cases.md`, `testing.md` and the other spec files in line. No code, migrations or endpoints.

## Context
The specs under `docs/agents/specs/issues/` were checked against `origin/main` at `2e14499`: they still contain the "By repository id" bullet, the `404, repository readable` mapping row, `paused` in the derived states and precedence, a boolean attach confirmation, "unlinking an issue with no link is a missing resource" and testing.md's "Id-based path contract spec (required)". No specialist agent owns documentation; no candidate agent (backend, frontend, infra, ...) has work, so this is a single plan owned by the architect.

## Steps

- [01 — Rewrite github-link.md](plan/01-rewrite-github-link.md)
- [02 — Update edge-cases.md and testing.md](plan/02-update-edge-cases-and-testing.md)
- [03 — Consistency pass over the other spec files](plan/03-consistency-pass.md)

## Notes
- Outcomes only: routes, payloads and refusal codes stay with #489; `sync_failed` reasons and transitions with #488; credential permissions with #490; wording and placement with #491.
- The `Location` of a transferred issue has not been observed on real GitHub; the spec must say the contract spec records it and that "any other target means moved" is an assumption until then.
- Ids: E65 is the next free edge-case id (E1 to E64 exist); update every "E57 to E64" range to "E57 to E65".
- Verification (no code runs): after step 3, grep `docs/agents/specs/` for `paused`, `repositories/{id}`, `By repository id`, `repository readable` and `readable with the same credential`; none may remain as a current rule.
