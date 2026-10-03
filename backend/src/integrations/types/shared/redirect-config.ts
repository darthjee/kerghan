import { ConfigService } from '@nestjs/config';

// Env var whose origin a redirect-based type's callback URL is derived from.
export const FRONTEND_BASE_URL_VAR = 'FRONTEND_BASE_URL';

/**
 * Reads a config value, trimmed, defaulting to `''`.
 * @param {ConfigService} configService - The config source.
 * @param {string} key - The variable name.
 * @returns {string} The trimmed value.
 */
export function readTrimmed(configService: ConfigService, key: string): string {
  return (configService.get<string>(key) ?? '').trim();
}

/**
 * Derives a redirect-based type's callback URL from `FRONTEND_BASE_URL`'s
 * origin. Throws when `FRONTEND_BASE_URL` is missing, unparseable, not
 * http(s), or not `https` under `NODE_ENV=production`.
 * @param {ConfigService} configService - Supplies `FRONTEND_BASE_URL` and `NODE_ENV`.
 * @param {string} callbackPath - The landing path on the frontend origin.
 * @param {string} typeName - Human name of the type, used in error messages.
 * @returns {string} The callback URL.
 */
export function buildCallbackUrl(configService: ConfigService, callbackPath: string, typeName: string): string {
  const origin = parseOrigin(readTrimmed(configService, FRONTEND_BASE_URL_VAR), typeName);
  const isProduction = readTrimmed(configService, 'NODE_ENV') === 'production';

  if (isProduction && origin.protocol !== 'https:') {
    throw new Error(`${FRONTEND_BASE_URL_VAR} must be https when NODE_ENV=production and the ${typeName} is enabled`);
  }

  return `${origin.origin}${callbackPath}`;
}

/**
 * Parses `FRONTEND_BASE_URL`, requiring an http(s) URL.
 * @param {string} raw - The trimmed `FRONTEND_BASE_URL` value.
 * @param {string} typeName - Human name of the type, used in error messages.
 * @returns {URL} The parsed URL.
 */
export function parseOrigin(raw: string, typeName: string): URL {
  const problem = `${FRONTEND_BASE_URL_VAR} must be a valid http(s) URL when the ${typeName} is enabled`;
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error(problem);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(problem);
  }

  return url;
}
