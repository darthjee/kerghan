import { Body, Controller, Param, ParseIntPipe, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AdminService } from './admin.service.js';
import { SearchUsersDto } from './dto/search-users.dto.js';
import { User } from './entities/user.entity.js';
import { AdminOnly } from '../core/admin-only.decorator.js';

// See `AuthController`'s identical constant for why this header is set on
// every route here: Tent's `default_proxy` rule caches any 2xx `*.json`
// response by method-agnostic, query-string-only key, and these responses
// carry per-request secrets/PII that must never be cross-served between
// callers.
const SKIP_CACHE_HEADER = 'X-Skip-Cache';

/**
 * Admin-only routes for #41's user-lookup/password-recovery tool — thin,
 * delegating all business logic to `AdminService`. Every route requires the
 * default `JwtGuard` behavior (no `@Public()`) plus `@AdminOnly()`, applied
 * once at the controller level since every route here needs it.
 */
@Controller('admin')
@AdminOnly()
export class AdminController {
  private readonly adminService: AdminService;

  /**
   * @param {AdminService} adminService - The admin tool's business logic.
   */
  constructor(adminService: AdminService) {
    this.adminService = adminService;
  }

  /**
   * `POST /admin/users/:id/recovery-link.json`. Always mints a fresh
   * password-recovery token (never invalidates the user's other
   * outstanding tokens).
   * @param {number} id - The id of the user to mint a link for.
   * @param {Response} res - Used only to set the `X-Skip-Cache` header.
   * @returns {Promise<object>} `{ resetUrl }`.
   */
  @Post('users/:id/recovery-link.json')
  async recoveryLink(
    @Param('id', ParseIntPipe) id: number,
      @Res({ passthrough: true }) res: Response,
  ): Promise<object> {
    res.set(SKIP_CACHE_HEADER, 'true');

    return this.adminService.generateRecoveryLink(id);
  }

  /**
   * `POST /admin/users/search.json`. Looks up accounts, optionally filtered
   * by `dto.q`.
   * @param {SearchUsersDto} dto - Carries the optional search term.
   * @param {Response} res - Used only to set the `X-Skip-Cache` header.
   * @returns {Promise<object>} `{ users: [{ id, username, email, isAdmin, createdAt }] }`.
   */
  @Post('users/search.json')
  async search(@Body() dto: SearchUsersDto, @Res({ passthrough: true }) res: Response): Promise<object> {
    const users = await this.adminService.searchUsers(dto.q);
    res.set(SKIP_CACHE_HEADER, 'true');

    return { users: users.map((user) => this.#serializeUser(user)) };
  }

  /**
   * `POST /admin/users/:id/send-recovery-email.json`. Mints a fresh
   * password-recovery token the same way as `recoveryLink`, then sends it
   * directly and synchronously so the caller gets a real success/failure
   * result.
   * @param {number} id - The id of the user to send a recovery email to.
   * @param {Response} res - Used only to set the `X-Skip-Cache` header.
   * @returns {Promise<object>} `{ sent }`.
   */
  @Post('users/:id/send-recovery-email.json')
  async sendRecoveryEmail(
    @Param('id', ParseIntPipe) id: number,
      @Res({ passthrough: true }) res: Response,
  ): Promise<object> {
    res.set(SKIP_CACHE_HEADER, 'true');

    return this.adminService.sendRecoveryEmail(id);
  }

  #serializeUser(user: User): object {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
    };
  }
}
