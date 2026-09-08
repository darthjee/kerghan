import { Body, Controller, Param, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { respondWithSession, SKIP_CACHE_HEADER } from './auth-response.js';
import { AuthorizationRequestService } from './authorization-request.service.js';
import { CreateAuthorizationRequestDto } from './dto/create-authorization-request.dto.js';
import { PollAuthorizationRequestDto } from './dto/poll-authorization-request.dto.js';
import { extractClientRequestInfo } from '../core/client-request.js';
import { Public } from '../core/public.decorator.js';

/**
 * The requesting-device half of the login-by-authorization flow — thin,
 * delegating all business logic to `AuthorizationRequestService`. Both
 * routes are `@Public()`: they exist precisely for a not-yet-logged-in
 * device to establish credentials, so they must stay reachable without an
 * already-valid access token. Every route sets `X-Skip-Cache` so Tent's
 * proxy never caches — and cross-serves — a request/poll response between
 * devices.
 */
@Controller('auth')
export class AuthorizationRequestController {
  private readonly authorizationRequestService: AuthorizationRequestService;
  private readonly configService: ConfigService;

  /**
   * @param {AuthorizationRequestService} authorizationRequestService - The device-authorization
   *   flow's business logic.
   * @param {ConfigService} configService - Supplies the access-token TTL used for the winning
   *   poll's cookie `maxAge`.
   */
  constructor(authorizationRequestService: AuthorizationRequestService, configService: ConfigService) {
    this.authorizationRequestService = authorizationRequestService;
    this.configService = configService;
  }

  /**
   * `POST /auth/authorization-requests.json`. Creates a new device-authorization
   * request for `dto.username`. Responds identically whether or not the
   * username matches a real user, per the enumeration-safety contract.
   * @param {CreateAuthorizationRequestDto} dto - Carries the username to request authorization for.
   * @param {Request} req - Used to capture the requesting IP and User-Agent.
   * @param {Response} res - Used only to set the `X-Skip-Cache` header.
   * @returns {Promise<object>} `{ uuid, pollToken, expiresAt }`.
   */
  @Public()
  @Post('authorization-requests.json')
  async create(
    @Body() dto: CreateAuthorizationRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<object> {
    const { ip, userAgent } = extractClientRequestInfo(req);
    res.set(SKIP_CACHE_HEADER, 'true');

    return this.authorizationRequestService.create(dto.username, ip, userAgent);
  }

  /**
   * `POST /auth/authorization-requests/:uuid/poll.json`. Reports the current
   * status of a device-authorization request. On the winning `approved`
   * poll, mints a login session identical to a password login (same
   * `access_token` cookie + `{ user, refreshToken }` shape, via
   * `auth-response.ts`); every later or losing poll gets `{ status: 'logged' }`
   * with no credentials.
   * @param {string} uuid - The authorization request's UUID.
   * @param {PollAuthorizationRequestDto} dto - Carries the poll token.
   * @param {Response} res - Used to set the access-token cookie (on the
   *   winning poll) and the `X-Skip-Cache` header.
   * @returns {Promise<object>} `{ status }`, plus `user`/`refreshToken` on the winning `approved` poll.
   */
  @Public()
  @Post('authorization-requests/:uuid/poll.json')
  async poll(
    @Param('uuid') uuid: string,
    @Body() dto: PollAuthorizationRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<object> {
    const result = await this.authorizationRequestService.poll(uuid, dto.pollToken);

    if (result.status === 'approved') {
      return { status: 'approved', ...respondWithSession(result.authResult, res, this.configService) };
    }

    res.set(SKIP_CACHE_HEADER, 'true');

    return { status: result.status };
  }
}
