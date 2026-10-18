import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { readBooleanMetadata } from './boolean-metadata.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { buildSecretKeys } from './secret-keys.js';
import { SESSION_LOOKUP } from './session-lookup.js';
import type { SessionLookup } from './session-lookup.js';

// A verified but not yet validated token payload: claims are untrusted until
// `#validateClaims` checks their types.
type VerifiedPayload = Record<string, unknown>;

const INVALID_TOKEN_MESSAGE = 'Invalid or expired access token';

// A well-formed (any version/variant) UUID in its canonical 8-4-4-4-12 hex form.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The validated claims the session gate relies on.
 */
interface SessionClaims {
  sub: number;
  sid: string;
}

/**
 * Global guard verifying the JWT access token on every request, independent
 * of any feature module (per the issue's "Core" module classification), and
 * acting as the per-request session gate (rules 1 to 3 of
 * `docs/agents/specs/user-approval/security.md`). Reads the token from the
 * httpOnly `access_token` cookie set by the Auth module. Routes (or
 * controllers) annotated with `@Public()` skip verification entirely.
 *
 * Supports zero-downtime `KERGHAN_SECRET_KEY` rotation: a token is first
 * verified against the module secret (the current key), then against each
 * retired key from `KERGHAN_PREVIOUS_SECRET_KEYS`, in order. Tokens are only
 * ever signed with the current key (see `auth/token.service.ts`).
 *
 * After the signature/expiry check, the token's `sid` must be a well-formed
 * UUID string and its `sub` an integer (tokens without `sid`, minted before
 * the claim existed, are rejected with no legacy path); the session `sid`
 * must then be active (looked up through the injected `SESSION_LOOKUP`,
 * implemented by the Auth module), belong to `sub`, and its user must be
 * `approved` (rule 3, enforced by the lookup itself, always — whatever
 * `KERGHAN_USER_APPROVAL_REQUIRED` says). Every rejection
 * throws the same `UnauthorizedException` as an invalid signature; a lookup
 * error propagates (`500`). `request.user` is built from the session's user
 * row, never from the signed `username`/`isAdmin` claims, so `AdminGuard`
 * and `@CurrentUser()` always see current values.
 */
@Injectable()
export class JwtGuard implements CanActivate {
  private readonly jwtService: JwtService;
  private readonly reflector: Reflector;
  private readonly previousKeys: string[];
  private readonly sessionLookup: SessionLookup;

  /**
   * @param {JwtService} jwtService - Verifies/decodes the access token.
   * @param {Reflector} reflector - Reads the `@Public()` route metadata.
   * @param {ConfigService} configService - Supplies the retired secret keys
   *   still accepted when verifying (resolved once, at construction).
   * @param {SessionLookup} sessionLookup - Loads the user of the token's
   *   active session (provided by the Auth module under `SESSION_LOOKUP`).
   */
  constructor(
    jwtService: JwtService,
    reflector: Reflector,
    configService: ConfigService,
    @Inject(SESSION_LOOKUP) sessionLookup: SessionLookup,
  ) {
    this.jwtService = jwtService;
    this.reflector = reflector;
    this.previousKeys = buildSecretKeys(configService).previous;
    this.sessionLookup = sessionLookup;
  }

  /**
   * Allows public routes through, otherwise requires a valid access token
   * bound to an active session of its `sub`, and sets `request.user` from
   * that session's user.
   * @param {ExecutionContext} context - The current request's execution context.
   * @returns {Promise<boolean>} Whether the request may proceed.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (readBooleanMetadata(this.reflector, IS_PUBLIC_KEY, context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const { sub, sid } = this.#validateClaims(this.#verify(this.#extractToken(request)));
    const user = await this.sessionLookup.findActiveSessionUser(sid);

    if (!user || user.id !== sub) {
      throw this.#invalidToken();
    }

    request.user = { sub, sid, username: user.username, isAdmin: user.isAdmin };
    return true;
  }

  #extractToken(request: Request): string {
    const token = request.cookies?.access_token;

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    return token;
  }

  #verify(token: string): VerifiedPayload {
    const payload = this.#tryVerify(token) ?? this.#verifyWithPreviousKeys(token);

    if (!payload) {
      throw this.#invalidToken();
    }

    return payload;
  }

  #validateClaims(payload: VerifiedPayload): SessionClaims {
    const { sub, sid } = payload;

    if (typeof sid !== 'string' || !UUID_PATTERN.test(sid) || !Number.isInteger(sub)) {
      throw this.#invalidToken();
    }

    return { sub: sub as number, sid };
  }

  #invalidToken(): UnauthorizedException {
    return new UnauthorizedException(INVALID_TOKEN_MESSAGE);
  }

  #verifyWithPreviousKeys(token: string): VerifiedPayload | undefined {
    for (const secret of this.previousKeys) {
      const payload = this.#tryVerify(token, secret);

      if (payload) {
        return payload;
      }
    }

    return undefined;
  }

  #tryVerify(token: string, secret?: string): VerifiedPayload | undefined {
    try {
      return secret === undefined
        ? this.jwtService.verify<VerifiedPayload>(token)
        : this.jwtService.verify<VerifiedPayload>(token, { secret });
    } catch {
      return undefined;
    }
  }
}
