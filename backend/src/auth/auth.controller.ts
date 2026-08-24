import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthResult, AuthService } from './auth.service.js';
import { Public } from '../core/public.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { User } from './entities/user.entity.js';

const ACCESS_TOKEN_COOKIE = 'access_token';
const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
// Tent's `default_proxy` rule (`proxy/*_configuration/rules/backend.php`) caches any 2xx
// response to a `*.json` URL by method-agnostic, query-string-only key — these POST routes have
// no query string, so without this header a second caller could be served the first caller's
// cached credentials/tokens. See `docs/agents/architecture/proxy.md`'s "Cache bypass" section.
const SKIP_CACHE_HEADER = 'X-Skip-Cache';

/**
 * Auth module routes — thin, delegating all business logic to
 * `AuthService`. `login`/`register`/`refresh`/`logout` are all `@Public()`:
 * they exist precisely to establish or renew credentials, so they must
 * stay reachable without an already-valid access token. Every route also
 * sets `X-Skip-Cache` on its response so Tent's proxy never caches — and
 * cross-serves — a login/session response between users.
 */
@Controller('auth')
export class AuthController {
  private readonly authService: AuthService;

  /**
   * @param {AuthService} authService - The Auth module's business logic.
   */
  constructor(authService: AuthService) {
    this.authService = authService;
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
   * `POST /auth/logout.json`. Invalidates the given refresh token server-side
   * and clears the access-token cookie.
   * @param {RefreshTokenDto} dto - Carries the refresh token to invalidate.
   * @param {Response} res - Used to clear the access-token cookie.
   * @returns {Promise<void>} Resolves once the token has been revoked.
   */
  @Public()
  @Post('logout.json')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.authService.logout(dto.refreshToken);
    res.clearCookie(ACCESS_TOKEN_COOKIE);
    res.set(SKIP_CACHE_HEADER, 'true');
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

  #respond({ user, accessToken, refreshToken }: AuthResult, res: Response): object {
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: ACCESS_TOKEN_MAX_AGE_MS,
    });
    res.set(SKIP_CACHE_HEADER, 'true');

    return { user: this.#serialize(user), refreshToken };
  }

  #serialize(user: User): object {
    return { id: user.id, username: user.username, email: user.email };
  }
}
