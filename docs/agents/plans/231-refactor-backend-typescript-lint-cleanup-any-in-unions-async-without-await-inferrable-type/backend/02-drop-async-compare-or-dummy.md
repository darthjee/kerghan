# Drop async from compareOrDummy
Remove `async` from `compareOrDummy` and keep returning `bcrypt.compare(password, digest ?? DUMMY_DIGEST)` directly. The declared return type stays `Promise<boolean>`, so both callers and the existing spec keep working unchanged. Fixes `require-await`.

## Files to Change
- `backend/src/auth/dummy-digest.ts` — drop `async` from `compareOrDummy`.
