/**
 * Low-level HTTP helpers shared by `GithubClientService`'s calls. They never
 * see a credential: they only read response bodies and headers.
 */

/**
 * The normalised rate-limit headers every GitHub answer carries.
 */
export interface GithubRateLimitFields {
  /** `X-RateLimit-Remaining`, or `null` when absent or not numeric. */
  rateLimitRemaining: number | null;
  /** `X-RateLimit-Reset` (epoch seconds), or `null` when absent or not numeric. */
  rateLimitReset: number | null;
  /** `Retry-After` (seconds), or `null` when absent or not numeric. */
  retryAfter: number | null;
}

/**
 * Reads the normalised rate-limit headers.
 * @param {Headers} headers - The response headers.
 * @returns {GithubRateLimitFields} The rate-limit fields.
 */
export function rateLimitFields(headers: Headers): GithubRateLimitFields {
  return {
    rateLimitRemaining: numericHeader(headers, 'x-ratelimit-remaining'),
    rateLimitReset: numericHeader(headers, 'x-ratelimit-reset'),
    retryAfter: numericHeader(headers, 'retry-after'),
  };
}

/**
 * Reads a response body as text, stopping (and cancelling the stream) once
 * it exceeds `maxBytes`.
 * @param {Response} response - The fetch response.
 * @param {number} maxBytes - The largest body accepted, in bytes.
 * @returns {Promise<string | null>} The body text, or `null` when it was larger than `maxBytes`.
 */
export async function readCappedBody(response: Response, maxBytes: number): Promise<string | null> {
  if (response.body === null) {
    return '';
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    total += chunk.value.byteLength;

    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }

    chunks.push(chunk.value);
  }

  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Parses a JSON object body.
 * @param {string | null} body - The response body text, or `null` when it was too large.
 * @returns {Record<string, unknown>} The parsed object, or `{}` when absent, unparseable or not an object.
 */
export function parseJsonObject(body: string | null): Record<string, unknown> {
  if (body === null) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(body);

    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

/**
 * Reads a numeric header.
 * @param {Headers} headers - The response headers.
 * @param {string} name - The header name.
 * @returns {number | null} The number, or `null` when absent or not numeric.
 */
function numericHeader(headers: Headers, name: string): number | null {
  const raw = headers.get(name);

  if (raw === null || raw.trim() === '') {
    return null;
  }

  const value = Number(raw);

  return Number.isFinite(value) ? value : null;
}

/**
 * Whether a fetch failure was the timeout signal firing.
 * @param {unknown} error - The caught value.
 * @returns {boolean} `true` for a timeout/abort.
 */
export function isTimeout(error: unknown): boolean {
  // Duck-typed: `DOMException` may come from another realm, so `instanceof Error` isn't reliable.
  const name = typeof error === 'object' && error !== null ? (error as { name?: unknown }).name : undefined;

  return name === 'TimeoutError' || name === 'AbortError';
}
