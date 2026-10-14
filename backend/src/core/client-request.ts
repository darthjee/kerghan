import type { Request } from 'express';

/** The requesting client's IP address and User-Agent string. */
export interface ClientRequestInfo {
  ip: string;
  userAgent: string;
}

// Default number of trusted `X-Forwarded-For` proxy hops, matching today's single-Tent-hop
// deployment, used by callers that don't thread a `KERGHAN_TRUSTED_PROXY_HOPS`-driven value in.
export const DEFAULT_TRUSTED_PROXY_HOPS = 1;

const NON_NEGATIVE_INTEGER = /^\d+$/;

/**
 * Parses a raw `KERGHAN_TRUSTED_PROXY_HOPS` value into a trusted-hop count.
 * Only a non-negative integer string (e.g. `'0'`, `'1'`, `'2'`, surrounding
 * whitespace allowed) is accepted; anything else — unset, empty, non-numeric,
 * negative, or fractional — falls back to `DEFAULT_TRUSTED_PROXY_HOPS`, so a
 * misconfiguration can never make the leftmost, client-supplied
 * `x-forwarded-for` entry win.
 * @param {unknown} raw - The raw configured value (normally a string from `ConfigService`).
 * @returns {number} The parsed hop count, or `DEFAULT_TRUSTED_PROXY_HOPS` when invalid.
 */
export function parseTrustedProxyHops(raw: unknown): number {
  if (typeof raw === 'number') {
    return isValidHops(raw) ? raw : DEFAULT_TRUSTED_PROXY_HOPS;
  }

  if (typeof raw !== 'string' || !NON_NEGATIVE_INTEGER.test(raw.trim())) {
    return DEFAULT_TRUSTED_PROXY_HOPS;
  }

  const hops = Number(raw.trim());

  return isValidHops(hops) ? hops : DEFAULT_TRUSTED_PROXY_HOPS;
}

/**
 * Extracts the requesting client's IP address and User-Agent from an Express
 * `Request`, for endpoints (e.g. `AuthorizationRequestController#create`)
 * that need to record who made a request. This is a plain utility outside
 * NestJS DI, so `trustedProxyHops` — normally `KERGHAN_TRUSTED_PROXY_HOPS`,
 * read via `ConfigService` and parsed with `parseTrustedProxyHops` — must be
 * threaded in by the (injectable) caller.
 *
 * Deployment invariant: the resolved IP is only trustworthy when every
 * request reaches the backend through Tent, which overwrites
 * `x-forwarded-for` (the proxy's `SetClientIpMiddleware`). The socket peer is
 * NOT checked against a trusted proxy address, so a client that can reach the
 * backend port directly can forge the resolved IP.
 * @param {Request} req - The incoming Express request.
 * @param {number} trustedProxyHops - How many `x-forwarded-for` hops, counted from the right
 *   (nearest to this server), are trusted. Only that many trailing hops are ever considered;
 *   anything further left — which could be supplied by a client bypassing the trusted proxy
 *   chain entirely — is ignored. Defaults to `DEFAULT_TRUSTED_PROXY_HOPS`; a value that is not
 *   a non-negative safe integer (e.g. `NaN`, negative, fractional) is treated as the default.
 *   `0` trusts no hop at all: when the header is present, no hop is selected and the IP is
 *   `undefined` at runtime (unchanged legacy behavior; the socket fallback is NOT used).
 * @returns {ClientRequestInfo} The IP (the trusted-boundary token of `x-forwarded-for`, falling
 *   back to `req.socket.remoteAddress` when the header is absent) and the `user-agent` header
 *   (`''` when absent).
 */
export function extractClientRequestInfo(
  req: Request,
  trustedProxyHops: number = DEFAULT_TRUSTED_PROXY_HOPS,
): ClientRequestInfo {
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = extractIp(forwardedFor, req.socket.remoteAddress, trustedProxyHops);
  const userAgent = req.headers['user-agent'] ?? '';

  return { ip, userAgent };
}

/**
 * Picks the trusted-boundary `x-forwarded-for` hop. Same deployment invariant
 * as `extractClientRequestInfo`: only trustworthy behind Tent, which
 * overwrites the header. An invalid `trustedProxyHops` is treated as
 * `DEFAULT_TRUSTED_PROXY_HOPS`, so `NaN` can never select the leftmost
 * (client-forged) entry.
 * @param {string | string[] | undefined} forwardedFor - The raw `x-forwarded-for` header.
 * @param {string | undefined} fallback - The socket peer address, used when the header is absent.
 * @param {number} trustedProxyHops - The trusted-hop count.
 * @returns {string} The resolved IP.
 */
function extractIp(
  forwardedFor: string | string[] | undefined,
  fallback: string | undefined,
  trustedProxyHops: number,
): string {
  const value = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;

  if (!value) {
    return fallback ?? '';
  }

  const hops = value
    .split(',')
    .map((hop) => hop.trim())
    .filter((hop) => hop.length > 0);

  if (hops.length === 0) {
    return fallback ?? '';
  }

  const safeHops = isValidHops(trustedProxyHops) ? trustedProxyHops : DEFAULT_TRUSTED_PROXY_HOPS;
  const trustedIndex = Math.max(0, hops.length - safeHops);

  // `trustedIndex` is within `[0, hops.length)` for any `safeHops >= 1`: it is
  // clamped to `>= 0` and `hops` is non-empty. With `safeHops === 0` it equals
  // `hops.length`, so `at()` yields `undefined` (documented legacy behavior).
  return hops.at(trustedIndex)!;
}

function isValidHops(hops: number): boolean {
  return Number.isSafeInteger(hops) && hops >= 0;
}
