import type { Request } from 'express';

/** The requesting client's IP address and User-Agent string. */
export interface ClientRequestInfo {
  ip: string;
  userAgent: string;
}

/**
 * Extracts the requesting client's IP address and User-Agent from an Express
 * `Request`, for endpoints (e.g. `AuthorizationRequestController#create`)
 * that need to record who made a request. Nothing in the backend read these
 * headers before this helper.
 * @param {Request} req - The incoming Express request.
 * @returns {ClientRequestInfo} The IP (first token of `x-forwarded-for`,
 *   falling back to `req.socket.remoteAddress`) and the `user-agent` header
 *   (`''` when absent).
 */
export function extractClientRequestInfo(req: Request): ClientRequestInfo {
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = extractIp(forwardedFor, req.socket.remoteAddress);
  const userAgent = req.headers['user-agent'] ?? '';

  return { ip, userAgent };
}

function extractIp(forwardedFor: string | string[] | undefined, fallback: string | undefined): string {
  const value = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;

  if (!value) {
    return fallback ?? '';
  }

  return value.split(',')[0].trim();
}
