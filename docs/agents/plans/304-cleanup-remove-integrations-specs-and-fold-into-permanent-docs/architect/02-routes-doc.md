# Write the integrations routes doc

Create `docs/agents/backend/routes/integrations.md`, mirroring `backend/routes/auth.md`. Fold
in spec `api.md`: conventions, routes, enabled types, create envelope,
`## Integration response` (so the anchor is `#integration-response`),
`## Per-action behaviour` (so the anchor is `#per-action-behaviour`; keep the British spelling)
and error codes. Each type's own redirect-flow routes stay in the type file, but list them here
too, with links. Drop "Required tests".

Add `- [Integrations](routes/integrations.md)` to `docs/agents/backend/routes.md`.

## Files to Change
- `docs/agents/backend/routes/integrations.md`: new
- `docs/agents/backend/routes.md`: add the index entry
