import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AccessTokenPayload } from './access-token-payload.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

/**
 * Global guard verifying the JWT access token on every request, independent
 * of any feature module (per the issue's "Core" module classification).
 * Reads the token from the httpOnly `access_token` cookie set by the Auth
 * module. Routes (or controllers) annotated with `@Public()` skip
 * verification entirely.
 */
@Injectable()
export class JwtGuard implements CanActivate {
  private readonly jwtService: JwtService;
  private readonly reflector: Reflector;

  /**
   * @param {JwtService} jwtService - Verifies/decodes the access token.
   * @param {Reflector} reflector - Reads the `@Public()` route metadata.
   */
  constructor(jwtService: JwtService, reflector: Reflector) {
    this.jwtService = jwtService;
    this.reflector = reflector;
  }

  /**
   * Allows public routes through, otherwise requires a valid access token.
   * @param {ExecutionContext} context - The current request's execution context.
   * @returns {boolean} Whether the request may proceed.
   */
  canActivate(context: ExecutionContext): boolean {
    if (this.#isPublic(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.#extractToken(request);

    request.user = this.#verify(token);
    return true;
  }

  #extractToken(request: Request): string {
    const token = request.cookies?.access_token;

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    return token;
  }

  #isPublic(context: ExecutionContext): boolean {
    return Boolean(
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]),
    );
  }

  #verify(token: string): AccessTokenPayload {
    try {
      return this.jwtService.verify<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
