import { Body, Controller, Delete, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthResult, AuthService } from './auth.service.js';
import { Public } from '../core/public.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RecoverDto } from './dto/recover.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { User } from './entities/user.entity.js';

const ACCESS_TOKEN_COOKIE = 'access_token';
// Default access-token lifetime (15 minutes, in milliseconds) used when
// `KERGHAN_ACCESS_TOKEN_TTL_MS` is unset — must match `app.module.ts`'s
// `JwtModule.registerAsync` default so the cookie's `maxAge` always tracks
// the signed JWT's actual expiry.
const DEFAULT_ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
// Tent's `default_proxy` rule (`proxy/*_configuration/rules/backend.php`) caches any 2xx
// response to a `*.json` URL by method-agnostic, query-string-only key — these POST routes have
// no query string, so without this header a second caller could be served the first caller's
// cached credentials/tokens. See `docs/agents/architecture/proxy.md`'s "Cache bypass" section.
const SKIP_CACHE_HEADER = 'X-Skip-Cache';

/**
 * Auth module routes — thin, delegating all business logic to
 * `AuthService`. `login`/`register`/`refresh`/`logout`/`status` are all
 * `@Public()`: the first four exist precisely to establish or renew
 * credentials, and `status` exists to let an already-logged-out client
 * check its session without one — so all of them must stay reachable
 * without an already-valid access token. Every route also sets
 * `X-Skip-Cache` on its response so Tent's proxy never caches — and
 * cross-serves — a login/session response between users.
 */
@Controller('auth')
export class AuthController {
  private readonly authService: AuthService;
  private readonly configService: ConfigService;

  /**
   * @param {AuthService} authService - The Auth module's business logic.
   * @param {ConfigService} configService - Supplies the access-token TTL used
   *   for the cookie's `maxAge`.
   */
  constructor(authService: AuthService, configService: ConfigService) {
    this.authService = authService;
    this.configService = configService;
  }

  /**
   * `POST /auth/login.json`.
   * @param {LoginDto} dto - The login credentials.
   * @param {Response} res - Used to set the httpOnly access-token cookie.
   * @returns {Promise<object>} The public user view plus the refresh token.
   */
  @Public()
  @Post('login.json')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<object> {
    return this.#respond(await this.authService.login(dto), res);
  }

  /**
   * `DELETE /auth/logoff.json`. Invalidates the given refresh token
   * server-side and clears the access-token cookie.
   * @param {RefreshTokenDto} dto - Carries the refresh token to invalidate.
   * @param {Response} res - Used to clear the access-token cookie.
   * @returns {Promise<void>} Resolves once the token has been revoked.
   */
  @Public()
  @Delete('logoff.json')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.authService.logout(dto.refreshToken);
    res.clearCookie(ACCESS_TOKEN_COOKIE);
    res.set(SKIP_CACHE_HEADER, 'true');
  }

  /**
   * `POST /auth/recover.json`. Always responds `200 { sent: true }`,
   * whether or not `dto.email` matches an account — no status, body, or
   * timing difference should reveal whether the email is registered (see
   * `AuthService#recover`).
   * @param {RecoverDto} dto - Carries the email to look up.
   * @param {Response} res - Used only to set the `X-Skip-Cache` header.
   * @returns {Promise<object>} `{ sent: true }`, always `200`.
   */
  @Public()
  @Post('recover.json')
  @HttpCode(HttpStatus.OK)
  async recover(@Body() dto: RecoverDto, @Res({ passthrough: true }) res: Response): Promise<object> {
    await this.authService.recover(dto);
    res.set(SKIP_CACHE_HEADER, 'true');

    return { sent: true };
  }

  /**
   * `POST /auth/refresh.json`. Rotates the given refresh token.
   * @param {RefreshTokenDto} dto - Carries the refresh token to rotate.
   * @param {Response} res - Used to set the renewed access-token cookie.
   * @returns {Promise<object>} The public user view plus the new refresh token.
   */
  @Public()
  @Post('refresh.json')
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<object> {
    return this.#respond(await this.authService.refresh(dto.refreshToken), res);
  }

  /**
   * `POST /auth/register.json`.
   * @param {RegisterDto} dto - The registration payload.
   * @param {Response} res - Used to set the httpOnly access-token cookie.
   * @returns {Promise<object>} The public user view plus the refresh token.
   */
  @Public()
  @Post('register.json')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<object> {
    return this.#respond(await this.authService.register(dto), res);
  }

  /**
   * `POST /auth/reset-password.json`. Finishes a self-service password
   * recovery. Every rejection reason (unknown token, already-used token,
   * expired token) surfaces as the exact same `400 Bad Request` — never
   * `401`, so the frontend's shared `ApiClient` doesn't intercept it as a
   * session-refresh candidate (see `AuthService#resetPassword`).
   * @param {ResetPasswordDto} dto - Carries the token and the new password.
   * @param {Response} res - Used only to set the `X-Skip-Cache` header.
   * @returns {Promise<object>} `{ reset: true }` on success.
   */
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

  /**
   * `POST /auth/status.json`. Reports whether the given refresh token still
   * identifies an active session, without setting/clearing the
   * access-token cookie or mutating anything server-side — used for
   * mount-time login-state confirmation (e.g. the frontend header), not for
   * establishing or renewing credentials.
   * @param {RefreshTokenDto} dto - Carries the refresh token to check.
   * @param {Response} res - Used only to set the `X-Skip-Cache` header.
   * @returns {Promise<object>} `{ loggedIn: boolean }`, always `200`.
   */
  @Public()
  @Post('status.json')
  async status(@Body() dto: RefreshTokenDto, @Res({ passthrough: true }) res: Response): Promise<object> {
    res.set(SKIP_CACHE_HEADER, 'true');

    return this.authService.status(dto.refreshToken);
  }

  #respond({ user, accessToken, refreshToken }: AuthResult, res: Response): object {
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: this.configService.get<number>('KERGHAN_ACCESS_TOKEN_TTL_MS', DEFAULT_ACCESS_TOKEN_TTL_MS),
    });
    res.set(SKIP_CACHE_HEADER, 'true');

    return { user: this.#serialize(user), refreshToken };
  }

  #serialize(user: User): object {
    return { id: user.id, username: user.username, email: user.email };
  }
}
