# Reset-password endpoint

Implement `POST /auth/reset-password.json`: validates the token, sets the new password, marks
the token used, and revokes the user's other sessions.

Add `ResetPasswordDto` (`{ token: string, password: string }` — `@IsString() @IsNotEmpty()` on
`token`, `@IsString() @MinLength(8)` on `password`, matching `RegisterDto`'s password rule).
`password_confirmation`, sent by the frontend, is not part of the DTO — it's stripped by the
global `ValidationPipe`'s `whitelist: true`, the same as `RegisterDto` today; equality is a
client-only UX check (see `frontend.md`).

Add `AuthService#resetPassword(dto: ResetPasswordDto): Promise<void>`, following
`#findActiveRefreshToken`'s exact "collapse every rejection reason into the same exception"
shape, but throwing `BadRequestException` (not `UnauthorizedException` — see `plan.md`'s "Shared
contracts" for why) and reusing `#hashToken`:

```ts
async resetPassword(dto: ResetPasswordDto): Promise<void> {
  const tokenRow = await this.#findActivePasswordResetToken(dto.token);
  const passwordDigest = await bcrypt.hash(dto.password, 10);

  await this.userRepository.update(tokenRow.userId, { passwordDigest });
  await this.passwordResetTokenRepository.update(tokenRow.id, { usedAt: new Date() });
  await this.#revokeTokenFamily(tokenRow.userId);
}

async #findActivePasswordResetToken(token: string): Promise<PasswordResetToken> {
  const tokenHash = this.#hashToken(token);
  const tokenRow = await this.passwordResetTokenRepository.findOneBy({ tokenHash });

  if (!tokenRow || tokenRow.usedAt || tokenRow.expiresAt < new Date()) {
    throw new BadRequestException('Invalid or expired token');
  }

  return tokenRow;
}
```

`#revokeTokenFamily(userId)` already exists (added for refresh-token replay detection) and is
reused as-is — no changes needed to it.

On `AuthController`, add:

```ts
@Public()
@Post('reset-password.json')
@HttpCode(HttpStatus.OK)
async resetPassword(
  @Body() dto: ResetPasswordDto,
  @Res({ passthrough: true }) res: Response,
): Promise<object> {
  await this.authService.resetPassword(dto);
  res.set(SKIP_CACHE_HEADER, 'true');
  return { reset: true };
}
```

## Files to Change

- `backend/src/auth/dto/reset-password.dto.ts` — new DTO, as above.
- `backend/src/auth/auth.service.ts` — add `#resetPassword`, `#findActivePasswordResetToken`.
- `backend/src/auth/auth.controller.ts` — add the `reset-password.json` route, as above.
- `backend/src/auth/tests/auth.service.spec.ts` — unit tests: success path (password updated,
  token marked used, other refresh tokens revoked); each rejection reason (unknown token,
  used token, expired token, invalid password) throws the identical
  `BadRequestException('Invalid or expired token')` (password-validation failures are a
  separate `ValidationPipe` 400, not asserted here — see `plan.md`).
- `backend/src/auth/tests/auth.controller.e2e-spec.ts` — e2e test: `200 { reset: true }` with
  `X-Skip-Cache: true` on success; `400` for a bad token, asserting the response body's actual
  shape (status + that the message field is present) so the #42 mismatch stays visible rather
  than silently masked by an assertion that only checks status.
