# Architect Plan: Support KERGHAN_SECRET_KEY rotation without downtime

Main plan: [plan.md](plan.md)

## Shared contracts

The new optional `KERGHAN_PREVIOUS_SECRET_KEYS` variable (comma-separated; trimmed and
de-duplicated; the current key is ignored if listed) and the four-step rotation procedure,
exactly as defined in [plan.md](plan.md#shared-contracts).

## Implementation Steps

### Step 1 — Environment variables doc and dev sample
- `docs/agents/environment-variables.md`:
  - Rewrite the `KERGHAN_SECRET_KEY` row. It is the current key: it signs JWT access tokens,
    derives the HMAC cache token (the service exists but has no callers yet) and is the first
    `cookie-parser` secret (no cookie is signed today, so this is dormant).
  - Add a `KERGHAN_PREVIOUS_SECRET_KEYS` row (**Consumed**, optional; Source:
    `backend/src/core/secret-keys.ts`, `backend/src/core/jwt.guard.ts`, `backend/src/main.ts`).
  - Add a short "Rotating `KERGHAN_SECRET_KEY`" subsection containing the four-step runbook
    and its side effects (cache-token change, refresh tokens unaffected).
- `.env.dev.sample`: add an empty `KERGHAN_PREVIOUS_SECRET_KEYS=` line right under
  `KERGHAN_SECRET_KEY`, with a short comment.

### Step 2 — Auth module doc
- `docs/agents/modules/auth.md`, "JWT/refresh-token flow" → Access token bullet: explain that
  verification also accepts previous keys from `KERGHAN_PREVIOUS_SECRET_KEYS`. Link to the
  runbook in `environment-variables.md` instead of duplicating it.

## Files to Change
- `docs/agents/environment-variables.md`: corrected row, new variable row, rotation runbook
- `docs/agents/modules/auth.md`: mention previous-key verification and link to the runbook
- `.env.dev.sample`: new empty variable

## CI Checks
- Markdown: follow the repo's markdownlint conventions (recently enforced in #238/#239); there
  is no dedicated CI job.

## Notes
- Do not add a separate operations doc. The user chose to keep the runbook in these two docs.
