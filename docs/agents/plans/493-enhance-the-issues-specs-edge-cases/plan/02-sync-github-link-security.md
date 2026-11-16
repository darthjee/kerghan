# Align sync, github-link and security

Make the three files consistent with `edge-cases.md`, linking rows by id.

- `sync.md`: the conflict question becomes "outcome fixed in edge-cases (E6 to E11); mechanics #488"; add rules for rate limits not counting toward retries (E17), retries exhausted and recovery (E18), duplicate jobs and crash after push (E13, E15, E16), non-approved users skipped (E24), and the no-credential outcome (E19, E20). Keep the remaining open questions that still belong to #488 (fields, full link states, staleness, which integration is used).
- `github-link.md`: the deleted or transferred question is answered at outcome level (E1 to E3, E22): link goes to a "gone" state, marker discarded, no auto-unlink, pull requests refused; state names and GitHub's actual answers stay with #487.
- `security.md`: record the revoked or read-only credential outcome (E19 to E21), the `404` rule (E22) and the non-approved user rule (E24); the question of how a write-capable credential is requested stays with #490.
- Required-tests sections gain one line per new rule, citing the row id.

## Files to Change
- `docs/agents/specs/issues/sync.md` — outcome rules and open questions.
- `docs/agents/specs/issues/github-link.md` — deleted or transferred outcome.
- `docs/agents/specs/issues/security.md` — credential outcomes.
