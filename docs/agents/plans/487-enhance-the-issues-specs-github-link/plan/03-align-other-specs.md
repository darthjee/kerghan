# Update model.md and the sync, ui, security and testing specs

- `model.md`, `issues_github_links`: add the nullable `status_reason` (`varchar(32)`); rewrite the `status` row (values `linked`, `gone`, `sync_failed`, with the reasons owned by #487 for `gone` and by #488 for `sync_failed`); remove "values are owned by #487 and #488" wording and the "pull requests are #487's rule" and "If a transfer changes an issue's id or number, #487 settles it" notes (the rules are now in `github-link.md`); the "No `repository_id` on the link" bullet must say the repository can change only at zero links; update the open question about link states and the unlink action, the "Owned elsewhere" scope line and the index note ("links by status"). In the cleanup section, add unlink to the lock-order wording if it is not covered. Keep the edge-case rows 6 and 7 consistent (the refusal code stays #489's).
- `sync.md`: replace any "#487 decides" statements; say the link states are stored (`linked`, `gone`, `sync_failed` plus a reason) and the rest derived, that #488 owns the `sync_failed` reasons and transitions, that a gone link creates no marker and gets no push or refresh, and that reads and pushes address the repository by its GitHub id; the open question "The full set of link states" becomes the `sync_failed` reasons and transitions.
- `ui.md`: the display of the link states follows the precedence order of `github-link.md`; the unlink action needs the unsent-changes confirmation, the attach action the replace confirmation, gone offers unlink and no retry sync; add a required test for each.
- `security.md`: a not-found answer on link creation never reveals more than the owner's credential can read; the owner's credentials do the read; no GitHub content in logs or job params.
- `testing.md`: add the contract spec for the id-based path and the `301`, `404` and `410` answers to the fixtures and fidelity contract, replace "#487 owns the unlinking and state names" mentions with pointers to `github-link.md`, and add the tiers for E57 to E64 where the coverage-per-area table lists the link; keep "#488 and #487 own the GitHub operation names" accurate.
- `docs/agents/specs/issues.md`: update the product decisions line about the link (states and repository change) only if it contradicts the new rules.

## Files to Change
- `docs/agents/specs/issues/model.md` — `status_reason`, `status` values, notes owned by #487, scope line, open question.
- `docs/agents/specs/issues/sync.md` — stored and derived states, gone link, repository by id, open questions.
- `docs/agents/specs/issues/ui.md` — states, precedence, confirmations, required tests.
- `docs/agents/specs/issues/security.md` — non-disclosure and credential rules on link creation.
- `docs/agents/specs/issues/testing.md` — the contract spec, tiers, pointers.
- `docs/agents/specs/issues.md` — only if a decision line contradicts the new rules.
