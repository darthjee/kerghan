# Recover endpoint

Implement `POST /auth/recover.json`: enumeration-safe, always `200 { sent: true }`.

Add `RecoverDto` (`{ email: string }`, `@IsEmail()`, matching `RegisterDto`'s email validation).

In `AuthService`, inject `Repository<PasswordResetToken>` the same way `refreshTokenRepository`/
`sessionRepository` are injected (constructor param + private field), and inject
`ConfigService` (not yet a dependency of `AuthService` — `AuthController` already injects it for
the access-token cookie `maxAge`, but `AuthService` doesn't; add it here) to read
`FRONTEND_BASE_URL` and the new `KERGHAN_PASSWORD_RESET_TOKEN_TTL_MS` (see step 03).

Add `AuthService#recover(dto: RecoverDto): Promise<void>`:

```ts
async recover(dto: RecoverDto): Promise<void> {
  const user = await this.userRepository.findOneBy({ email: dto.email });

  if (!user) {
    return;
  }

  const token = randomBytes(48).toString('hex');
  const ttlMs = this.configService.get<number>(
    'KERGHAN_PASSWORD_RESET_TOKEN_TTL_MS',
    DEFAULT_PASSWORD_RESET_TOKEN_TTL_MS,
  );

  await this.passwordResetTokenRepository.save(
    this.passwordResetTokenRepository.create({
      userId: user.id,
      tokenHash: this.#hashToken(token),
      expiresAt: new Date(Date.now() + ttlMs),
      usedAt: null,
    }),
  );

  const resetUrl = `${this.configService.get<string>('FRONTEND_BASE_URL')}/#/recover-password?token=${token}`;

  this.eventEmitter.emit(
    'password-recovery.requested',
    new PasswordRecoveryRequestedEvent(user.id, token, resetUrl),
  );
}
```

`DEFAULT_PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000`, declared as a module-level constant the
same way `DEFAULT_ACCESS_TOKEN_TTL_MS` is in `app.module.ts`/`auth.controller.ts`.

No timing-safe padding is needed here (unlike `login`'s `DUMMY_DIGEST` bcrypt-compare trick):
`recover` does a single indexed lookup either way, and the only extra work on the match branch
(token generation + one insert) is negligible compared to network/DB jitter — the reference
material this issue was adapted from does not add artificial delay either.

On `AuthController`, add:

```ts
@Public()
@Post('recover.json')
@HttpCode(HttpStatus.OK)
async recover(@Body() dto: RecoverDto, @Res({ passthrough: true }) res: Response): Promise<object> {
  await this.authService.recover(dto);
  res.set(SKIP_CACHE_HEADER, 'true');
  return { sent: true };
}
```

(`@HttpCode(HttpStatus.OK)` is needed because Nest's default for `@Post` is `201`.)

## Files to Change

- `backend/src/auth/dto/recover.dto.ts` — new DTO, as above.
- `backend/src/auth/auth.service.ts` — inject `PasswordResetToken` repository and
  `ConfigService`; add `DEFAULT_PASSWORD_RESET_TOKEN_TTL_MS`; add `#recover`.
- `backend/src/auth/auth.controller.ts` — add the `recover.json` route, as above.
- `backend/src/auth/auth.module.ts` — no further change beyond step 01's
  `TypeOrmModule.forFeature` addition (`ConfigService` is already globally available via
  `@nestjs/config`).
- `backend/src/auth/tests/auth.service.spec.ts` — unit tests: token+event created and
  `resetUrl` shaped correctly when the email matches; no token/event, no throw, when it doesn't.
- `backend/src/auth/tests/auth.controller.e2e-spec.ts` — e2e test: `200 { sent: true }` for
  both a known and an unknown email, with `X-Skip-Cache: true` on the response.
