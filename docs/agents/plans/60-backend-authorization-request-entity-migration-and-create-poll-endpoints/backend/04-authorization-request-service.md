# AuthorizationRequestService

The core logic. An internal collaborator (not exported from `AuthModule`), like
`PasswordResetService`. Injects `Repository<AuthorizationRequest>`, `Repository<User>`,
`TokenService`, `EventEmitter2`, `ConfigService`.

## `create(username, ip, userAgent)`

1. Resolve `username → user` via the `User` repository (`findOneBy({ username })` or equivalent);
   may resolve to `null`.
2. Mint the poll token: `randomBytes(48).toString('hex')`.
3. Read the TTL as `Number(configService.get('KERGHAN_AUTHORIZATION_REQUEST_TTL_MS'))` with a
   module-level `const DEFAULT_AUTHORIZATION_REQUEST_TTL_MS = 3600000` fallback — coerce with
   `Number(...)` (as `mail/mail.config.ts` does), **not** the bare `get<number>(key, default)` form
   `password-reset.service.ts` uses, because `ConfigService.get` returns the raw string when the
   env var is actually set, and `Date.now() + '<string>'` would silently corrupt `expires_at`.
4. Persist a row: `uuid = crypto.randomUUID()`, `username`, `userId: user?.id ?? null`,
   `status: 'open'`, `pollTokenHash: sha256(token)`, `requestIp: ip`, `requestUserAgent: userAgent`,
   `expiresAt: now + ttl`.
5. Emit `authorization-request.created`.
6. Return `{ uuid, pollToken: token, expiresAt }` — **never** branch the return shape on whether
   `user` was found; a non-matching username must be indistinguishable in response shape and
   timing from a matching one.

## `poll(uuid, pollToken)`

1. `findOneBy({ uuid, pollTokenHash: sha256(pollToken) })`. A miss on either → `NotFoundException`
   (unknown `uuid` and wrong `pollToken` must be indistinguishable — both a plain 404).
2. Lazy expiry: if `status === 'open'` and `now > expiresAt`, update the row to
   `status: 'expired', resolvedAt: now` and return `{ status: 'expired' }`.
3. `status === 'open'` (not expired) → return `{ status: 'open' }`.
4. `status === 'approved'` → attempt the atomic claim:
   `repo.createQueryBuilder().update().set({ status: 'logged', loggedAt: () => 'CURRENT_TIMESTAMP' }).where("uuid = :uuid AND status = 'approved'", { uuid }).execute()`.
   - `result.affected === 1` (the winner): call `tokenService.issueTokens(user)` for the row's
     `userId`, emit `authorization-request.logged`, and return
     `{ status: 'approved', user, refreshToken }` — serialize `user` through the same
     `auth-response.ts` serializer from Step 2, so this shape is byte-identical to the
     password-login response's `user` field.
   - `result.affected === 0` (lost the race, or already claimed by a concurrent poll): re-read the
     row and return `{ status: 'logged' }` with no credentials.
5. `status === 'denied'` or `status === 'logged'` (already resolved, not via this poll) → return
   `{ status }` with no credentials.

**Important:** within this issue's scope, `resolvedAt` is set **only** on the lazy-expiry path
(step 2). The `approved → logged` claim (step 4) sets `loggedAt` but must **not** write
`resolvedAt` — that's the approver side's job (`authorize`/`deny`, a separate #58 sub-issue) when
it transitions `open → approved`/`denied`. Do not add a `resolvedAt` write to the claim `UPDATE`.

## Files to Change

- `backend/src/auth/authorization-request.service.ts` — new. `create`/`poll` as described above.
