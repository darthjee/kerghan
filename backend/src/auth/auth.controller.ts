import { Body, Controller, Delete, HttpCode, HttpStatus, Patch, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AccountService } from './account.service.js';
import {
  clearSessionCookies,
  clearSessionCookiesOnUnauthorized,
  readRefreshToken,
  resolveRefreshToken,
} from './auth-cookies.js';
import { respondWithSession } from './auth-response.js';
import { AuthService } from './auth.service.js';
import type { AccessTokenPayload } from '../core/access-token-payload.js';
import { CacheClass } from '../core/cache-class.js';
import { CachePolicy } from '../core/cache-policy.decorator.js';
import { CurrentUser } from '../core/current-user.decorator.js';
import { Public } from '../core/public.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RecoverDto } from './dto/recover.dto.js';
import { RefreshFallbackDto } from './dto/refresh-fallback.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';

/**
 * Auth module routes — thin, delegating all business logic to
 * `AuthService`. `login`/`register`/`refresh`/`logout`/`status` are all
 * `@Public()`: the first four exist precisely to establish or renew
 * credentials, and `status` exists to let an already-logged-out client
 * check its session without one — so all of them must stay reachable
 * without an already-valid access token. `@CachePolicy(CacheClass.Never)` is
 * applied once at the controller level so Tent's proxy never caches — and
 * cross-serves — a login/session response between users, and browsers never
 * store it either. No route overrides it: every route here is a write that
 * issues, renews, or revokes credentials.
 */
@Controller('auth')
@CachePolicy(CacheClass.Never)
export class AuthController {
  private readonly authService: AuthService;
  private readonly configService: ConfigService;
  private readonly accountService: AccountService;

  /**
   * @param {AuthService} authService - The Auth module's business logic.
   * @param {ConfigService} configService - Supplies the access-token TTL used
   *   for the cookie's `maxAge`.
   * @param {AccountService} accountService - The self-service "My Account" update flow's business logic.
   */
  constructor(authService: AuthService, configService: ConfigService, accountService: AccountService) {
    this.authService = authService;
    this.configService = configService;
    this.accountService = accountService;
  }

  /**
   * `PATCH /auth/account.json`. Authenticated (default `JwtGuard`, no
   * `@Public()`). Updates the caller's own username, email, and/or password,
   * always confirmed by their current password (see `AccountService#updateAccount`).
   * On a password change, the session identified by the `refresh_token`
   * cookie is kept and every other one revoked (missing/unknown cookie:
   * all revoked).
   * @param {UpdateAccountDto} dto - The requested changes plus the current password.
   * @param {AccessTokenPayload} user - The caller's own authenticated user, supplying the user ID.
   * @param {Request} req - Carries the caller's `refresh_token` cookie.
   * @returns {Promise<object>} `{ username, email }` on success.
   */
  @Patch('account.json')
  async updateAccount(
    @Body() dto: UpdateAccountDto,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<object> {
    return this.accountService.updateAccount(user.sub, dto, readRefreshToken(req));
  }

  /**
   * `POST /auth/login.json`.
   * @param {LoginDto} dto - The login credentials.
   * @param {Response} res - Used to set the session cookies.
   * @returns {Promise<object>} `{ user }`, the public user view.
   */
  @Public()
  @Post('login.json')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<object> {
    return respondWithSession(await this.authService.login(dto), res, this.configService);
  }

  /**
   * `DELETE /auth/logoff.json`. Invalidates the `refresh_token` cookie's
   * token server-side (when present) and always clears the session cookies.
   * @param {Request} req - Carries the `refresh_token` cookie.
   * @param {Response} res - Used to clear the session cookies.
   * @returns {Promise<void>} Resolves once the token has been revoked.
   */
  @Public()
  @Delete('logoff.json')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const refreshToken = readRefreshToken(req);

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    clearSessionCookies(res);
  }

  /**
   * `POST /auth/recover.json`. Always responds `200 { sent: true }`,
   * whether or not `dto.email` matches an account — no status, body, or
   * timing difference should reveal whether the email is registered (see
   * `AuthService#recover`).
   * @param {RecoverDto} dto - Carries the email to look up.
   * @returns {Promise<object>} `{ sent: true }`, always `200`.
   */
  @Public()
  @Post('recover.json')
  @HttpCode(HttpStatus.OK)
  async recover(@Body() dto: RecoverDto): Promise<object> {
    await this.authService.recover(dto);

    return { sent: true };
  }

  /**
   * `POST /auth/refresh.json`. Rotates the `refresh_token` cookie's token
   * (or, only when the cookie is absent, the body's migration-fallback
   * token — `TODO(#324-migration)`) and sets the renewed session cookies. A
   * missing or rejected token answers `401` and clears the session cookies.
   * @param {Request} req - Carries the `refresh_token` cookie.
   * @param {RefreshFallbackDto} dto - The optional migration-fallback token.
   * @param {Response} res - Used to set (or clear) the session cookies.
   * @returns {Promise<object>} `{ user }`, the public user view.
   */
  @Public()
  @Post('refresh.json')
  async refresh(
    @Req() req: Request,
    @Body() dto: RefreshFallbackDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<object> {
    const result = await clearSessionCookiesOnUnauthorized(
      res,
      resolveRefreshToken(req, dto.refreshToken),
      (token) => this.authService.refresh(token),
    );

    return respondWithSession(result, res, this.configService);
  }

  /**
   * `POST /auth/register.json`.
   * @param {RegisterDto} dto - The registration payload.
   * @param {Response} res - Used to set the session cookies.
   * @returns {Promise<object>} `{ user }`, the public user view.
   */
  @Public()
  @Post('register.json')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<object> {
    return respondWithSession(await this.authService.register(dto), res, this.configService);
  }

  /**
   * `POST /auth/reset-password.json`. Finishes a self-service password
   * recovery. Every rejection reason (unknown token, already-used token,
   * expired token) surfaces as the exact same `400 Bad Request` — never
   * `401`, so the frontend's shared `ApiClient` doesn't intercept it as a
   * session-refresh candidate (see `AuthService#resetPassword`).
   * @param {ResetPasswordDto} dto - Carries the token and the new password.
   * @returns {Promise<object>} `{ reset: true }` on success.
   */
  @Public()
  @Post('reset-password.json')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<object> {
    await this.authService.resetPassword(dto);

    return { reset: true };
  }

  /**
   * `POST /auth/status.json`. Reports whether the `refresh_token` cookie
   * still identifies an active session, without mutating anything
   * server-side — used for mount-time login-state confirmation (e.g. the
   * frontend header), not for establishing or renewing credentials. A
   * `loggedIn: false` answer clears the session cookies so the frontend's
   * `logged_in` marker can't outlive the session.
   * @param {Request} req - Carries the `refresh_token` cookie.
   * @param {Response} res - Used to clear the session cookies when logged out.
   * @returns {Promise<object>} `{ loggedIn: boolean, isAdmin: boolean }`, always `200`.
   */
  @Public()
  @Post('status.json')
  async status(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<object> {
    const result = await this.authService.status(readRefreshToken(req));

    if (!result.loggedIn) {
      clearSessionCookies(res);
    }

    return result;
  }
}
