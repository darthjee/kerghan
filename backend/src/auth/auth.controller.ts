import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../core/public.decorator.js';
import { AuthResult, AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { User } from './entities/user.entity.js';

const ACCESS_TOKEN_COOKIE = 'access_token';
const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;

/**
 * Auth module routes — thin, delegating all business logic to
 * `AuthService`. `login`/`register`/`refresh`/`logout` are all `@Public()`:
 * they exist precisely to establish or renew credentials, so they must
 * stay reachable without an already-valid access token.
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
   * `POST /auth/login`.
   * @param {LoginDto} dto - The login credentials.
   * @param {Response} res - Used to set the httpOnly access-token cookie.
   * @returns {Promise<object>} The public user view plus the refresh token.
   */
  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<object> {
    return this.#respond(await this.authService.login(dto), res);
  }

  /**
   * `POST /auth/logout`. Invalidates the given refresh token server-side
   * and clears the access-token cookie.
   * @param {RefreshTokenDto} dto - Carries the refresh token to invalidate.
   * @param {Response} res - Used to clear the access-token cookie.
   * @returns {Promise<void>} Resolves once the token has been revoked.
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.authService.logout(dto.refreshToken);
    res.clearCookie(ACCESS_TOKEN_COOKIE);
  }

  /**
   * `POST /auth/refresh`. Rotates the given refresh token.
   * @param {RefreshTokenDto} dto - Carries the refresh token to rotate.
   * @param {Response} res - Used to set the renewed access-token cookie.
   * @returns {Promise<object>} The public user view plus the new refresh token.
   */
  @Public()
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<object> {
    return this.#respond(await this.authService.refresh(dto.refreshToken), res);
  }

  /**
   * `POST /auth/register`.
   * @param {RegisterDto} dto - The registration payload.
   * @param {Response} res - Used to set the httpOnly access-token cookie.
   * @returns {Promise<object>} The public user view plus the refresh token.
   */
  @Public()
  @Post('register')
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

    return { user: this.#serialize(user), refreshToken };
  }

  #serialize(user: User): object {
    return { id: user.id, username: user.username, email: user.email };
  }
}
