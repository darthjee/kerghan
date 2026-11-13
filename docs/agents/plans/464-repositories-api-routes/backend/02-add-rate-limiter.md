# In-memory Add rate limiter

This step adds `RepositoryAddRateLimiter`, an injectable singleton holding a per-process `Map<userId, { windowStart: number; count: number }>`. It is a fixed window per user:

- `consume(userId)` returns `{ allowed: true }` or `{ allowed: false; retryAfterMs }`.
- When `now - windowStart >= windowMs`, the window restarts at `now` with count 1.
- When `count < max`, the count goes up and the call is allowed.
- Otherwise the call is refused, with `retryAfterMs = windowStart + windowMs - now`.

Time comes from the injected `Clock`, never from `Date.now()`. Every attempt that passes validation counts, whatever its later outcome (`api.md#add`: "every attempt past validation counts").

The config is read once in the constructor with `getNumberConfig` (`ConfigService`):

- `KERGHAN_REPOSITORIES_ADD_MAX_PER_WINDOW`, default `30`;
- `KERGHAN_REPOSITORIES_ADD_WINDOW_MS`, default `60000`.

Non-positive values fall back the way `repositories-config.ts` does. Either extend `RepositoriesConfig` with `addMaxPerWindow` / `addWindowMs`, or keep them local; prefer extending `RepositoriesConfig` so every Repositories env var is read in one place.

**Bounded memory:** on each `consume`, drop expired entries with a cheap sweep, at most once per window, by iterating the map. This way an idle user's entry cannot live forever.

There is no table and no migration. The limiter resets on restart and counts per instance (the decision in the issue).

## Files to Change

- `backend/src/repositories/repository-add-rate-limiter.ts`: new.
- `backend/src/repositories/repositories-config.ts`: the two Add values, if extended there.
- `backend/src/repositories/tests/repository-add-rate-limiter.spec.ts`. With `FakeClock`, it covers:
  - the 30th Add allowed and the 31st refused;
  - `retryAfterMs` at the window's end, the window reopening after `advance(windowMs)`;
  - per-user isolation (the intruder unaffected);
  - the env overrides applied;
  - expired entries swept.
- `backend/src/repositories/tests/repositories-config.spec.ts`: the defaults and overrides of the new keys, if extended there.
