# Docs and boundary specs

- **`docs/agents/modules/workers.md`:** list `issues.reconcile` (owner module, params `{ linkId }`, retry override, triggers). Remove "No job exists yet" and "Not built: No job, no endpoint that enqueues one".
- **`issues.module.ts` JSDoc:** drop "writes nothing to GitHub" and describe the sync.
- **Writer boundary:** add the sync service's path to `WRITER_INJECTORS` in `integrations/tests/integrations-writer-boundary.spec.ts`, and replace the "starts with an empty allowlist" case.
- **Other docs:** update the Issues module doc under `docs/agents/modules/` if one describes the ports or their default bindings. Update `docs/agents/environment-variables/backend.md` only if a key's meaning changes (no new key is expected).
- **Spec drift:** if any implementation decision differs from the specs, update the spec file in the same PR.

## Files to Change

- `docs/agents/modules/workers.md`
- `backend/src/issues/issues.module.ts`: JSDoc
- `backend/src/integrations/tests/integrations-writer-boundary.spec.ts`
- `docs/agents/modules/issues*.md`, if present
