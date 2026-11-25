import type { Request } from 'express';

const IPV4_LITERAL = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function stripPort(host: string): string {
  if (host.startsWith('[')) {
    return /^(\[[^\]]*\])(:\d*)?$/.exec(host)?.[1] ?? host;
  }

  const colon = host.indexOf(':');

  return colon === -1 ? host : host.slice(0, colon);
}

function isLoopbackIPv4(hostname: string): boolean {
  const match = IPV4_LITERAL.exec(hostname);

  if (!match) {
    return false;
  }

  const octets = match.slice(1).map(Number);

  return octets[0] === 127 && octets.every((octet) => octet >= 0 && octet <= 255);
}

/**
 * Tells whether a raw `Host` header names a loopback host: exactly
 * `localhost`, an IPv4 literal in `127.0.0.0/8` or `[::1]` (port ignored,
 * case-insensitive). Anything missing or malformed is not loopback.
 * @param {string | undefined} host - The raw `Host` header value.
 * @returns {boolean} `true` when the host is loopback.
 */
export function isLoopbackHost(host: string | undefined): boolean {
  if (!host) {
    return false;
  }

  const hostname = stripPort(host.toLowerCase());

  return hostname === 'localhost' || hostname === '[::1]' || isLoopbackIPv4(hostname);
}

/**
 * Tells whether the request declares it came in over HTTPS, i.e. its
 * `X-Forwarded-Proto` header has an `https` entry (case-insensitive, comma
 * separated lists supported).
 * @param {Request} req - The incoming request.
 * @returns {boolean} `true` when an `https` entry is present.
 */
export function forwardedHttps(req: Request): boolean {
  const header = req.headers?.['x-forwarded-proto'];
  const values = Array.isArray(header) ? header : [header ?? ''];

  return values
    .flatMap((value) => value.split(','))
    .some((entry) => entry.trim().toLowerCase() === 'https');
}
