# Extract expired-token helper in auth.service.spec
In `auth.service.spec.ts`, the describes `refresh > when the refresh token has expired` and `status > when the refresh token has expired` have the same `beforeEach`:

```ts
refreshTokenRepository.findOneBy.mockResolvedValue({ ...activeToken, expiresAt: new Date(Date.now() - 1000) });
```

Extract a helper declared inside `describe('AuthService')` (it needs `refreshTokenRepository`), e.g. `stubExpiredRefreshToken(token)`, and call it from both `beforeEach`es. The `activeToken` constant is also declared identically at the top of both `refresh` and `status`; hoist it to the `AuthService` describe scope (or a `buildActiveToken()` helper) so the helper and both describes share one definition. Also check the sibling "already revoked" / "unknown" describes in `refresh` and `status` for the same setup repetition (`revokedAt` / `null` stubs) and fold those into similarly named helpers only if they are true duplicates.

## Files to Change
- `backend/src/auth/tests/auth.service.spec.ts` — add the helper (and shared `activeToken`), use it in the `refresh` and `status` expired-token describes.
