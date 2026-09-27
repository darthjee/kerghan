# Plan: Support KERGHAN_SECRET_KEY rotation without downtime

Issue: [285-support-kerghan-secret-key-rotation-without-downtime.md](../../issues/285-support-kerghan-secret-key-rotation-without-downtime.md)

## Overview
Keep `KERGHAN_SECRET_KEY` as the current key and add an optional `KERGHAN_PREVIOUS_SECRET_KEYS`
(comma-separated retired keys). A single core helper resolves both. JWTs keep being signed with
the current key only, while `JwtGuard` falls back to each previous key when verifying.
`cookie-parser` receives the full key list, and the cache token keeps using only the current
key. Docs gain the new variable and a rotation runbook.

## Agents involved

- [backend](backend.md)
- [architect](architect.md): docs and `.env.dev.sample`, which sit outside `backend/`. The
  backend agent's boundaries route new env vars and root-level files through the architect.

## Shared contracts

- **`KERGHAN_SECRET_KEY`** (unchanged name and meaning): the current key. It signs every new
  JWT, derives the cache token and is the first entry handed to `cookie-parser`.
- **`KERGHAN_PREVIOUS_SECRET_KEYS`** (new, optional, default empty): a comma-separated list of
  retired keys. Entries are trimmed, and blank entries plus entries equal to the current key
  (or duplicates) are dropped. The helper accepts a JWT signed with any of these keys (unless
  it has expired), feeds the keys to `cookie-parser` after the current key, and never uses
  them to sign anything.
- **Rotation procedure** (documented by the architect, implemented by the backend):
  1. Generate a new key.
  2. Deploy with `KERGHAN_SECRET_KEY=<new>` and `KERGHAN_PREVIOUS_SECRET_KEYS=<old>`.
  3. Wait at least `KERGHAN_ACCESS_TOKEN_TTL_MS` (default 15 min) so every token signed with
     the old key has expired.
  4. Deploy again with `<old>` removed from `KERGHAN_PREVIOUS_SECRET_KEYS`.
  - Side effect: the cache token changes at step 2, which only causes cache misses.
  - Refresh tokens are unaffected (they are random values stored as hashes).
