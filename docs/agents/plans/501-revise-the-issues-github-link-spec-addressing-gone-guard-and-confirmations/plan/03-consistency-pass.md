# Consistency pass over the other spec files

Read each file and change only the statements that restate an old rule.

- `sync.md`: the link-states bullet (`paused` is no longer a link state; the worker-side pause stays as E24) and the "full set of link states" open question (narrow it to the `sync_failed` reasons and transitions owned by #488).
- `model.md`: the `status` note (stored states `linked`, `gone`, `sync_failed`; `status_reason`; no `paused`).
- `ui.md`: the confirmations (unlink plain, attach bound to `updated_at`) and the repeat-unlink answer treated as already unlinked, wherever restated.
- `api.md`: the unlink and attach refusals (confirmation form, stale `updated_at` `409`, the distinct "not linked" refusal); outcomes only.
- `projects.md`, `security.md`: only if they restate addressing by repository id, the repository-readable guard or `paused`.
- Verification: grep `docs/agents/specs/` for `paused`, `repositories/{id}`, `By repository id`, `repository readable`, `readable with the same credential`; none may remain as a current rule (a mention inside "rejected alternatives" is fine).

## Files to Change
- `docs/agents/specs/issues/sync.md`, `model.md`, `ui.md`, `api.md` — as above.
- `docs/agents/specs/issues/projects.md`, `security.md` — only if they restate an old rule.
