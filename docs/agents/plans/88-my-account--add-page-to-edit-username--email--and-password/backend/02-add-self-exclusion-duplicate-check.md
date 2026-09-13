# Add self-exclusion duplicate check

`AuthService#assertAvailable` (`backend/src/auth/auth.service.ts:199-210`) checks a `username`/
`email` is unused, but has no way to exclude the current user's own row — using it as-is for an
account update would false-positive when a user "changes" a field to the value it already has, or
changes only the other field.

Add a variant that accepts the current user's id and excludes it from the lookup, e.g. a
`excludeUserId?: number` parameter added to `#assertAvailable` (or a new sibling method) that adds
a TypeORM `Not(userId)` condition to the `where` clause when provided. Keep `#register`'s existing
call sites unchanged (they simply omit the new parameter).

## Files to Change
- `backend/src/auth/auth.service.ts` — extend or add alongside `#assertAvailable` (lines
  ~199-210) to support excluding the current user's id from the duplicate check.
