import { ConfigService } from '@nestjs/config';
import { Secret } from '../../secret.js';

// Env var holding the OAuth App's client id.
export const OAUTH_APP_CLIENT_ID_VAR = 'KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID';
// Env var holding the OAuth App's client secret.
export const OAUTH_APP_CLIENT_SECRET_VAR = 'KERGHAN_GITHUB_OAUTH_APP_CLIENT_SECRET';
// Env var whose origin the callback URL is derived from.
const FRONTEND_BASE_URL_VAR = 'FRONTEND_BASE_URL';

// Path (on the frontend origin) GitHub redirects the browser back to.
export const OAUTH_APP_CALLBACK_PATH = '/integrations/oauth_app/callback';

// Shape of a valid OAuth App client id.
export const OAUTH_APP_CLIENT_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * DI token under which the validated OAuth App config is provided.
 */
export const OAUTH_APP_CONFIG = Symbol('OAUTH_APP_CONFIG');

/**
 * The OAuth App config when the type is disabled (both variables unset or blank).
 */
export interface DisabledOauthAppConfig {
  enabled: false;
}

/**
 * The OAuth App config when the type is enabled.
 * @property {string} clientId - The OAuth App client id (public).
 * @property {Secret<string>} clientSecret - The OAuth App client secret.
 * @property {string} callbackUrl - Origin of `FRONTEND_BASE_URL` plus the callback path.
 */
export interface EnabledOauthAppConfig {
  enabled: true;
  clientId: string;
  clientSecret: Secret<string>;
  callbackUrl: string;
}

export type OauthAppConfig = DisabledOauthAppConfig | EnabledOauthAppConfig;

/**
 * Reads and validates the OAuth App config at boot. Throws (failing Nest's
 * boot) when only one of the two variables is set, the client id is
 * malformed, or — when enabled — `FRONTEND_BASE_URL` is missing,
 * unparseable, or not `https` under `NODE_ENV=production`. Errors name the
 * variables, never their values.
 * @param {ConfigService} configService - Supplies the two variables, `FRONTEND_BASE_URL` and `NODE_ENV`.
 * @returns {OauthAppConfig} `{ enabled: false }`, or the enabled config.
 */
export function buildOauthAppConfig(configService: ConfigService): OauthAppConfig {
  const clientId = readTrimmed(configService, OAUTH_APP_CLIENT_ID_VAR);
  const clientSecret = readTrimmed(configService, OAUTH_APP_CLIENT_SECRET_VAR);

  if (clientId === '' && clientSecret === '') {
    return { enabled: false };
  }

  if (clientId === '' || clientSecret === '') {
    const missing = clientId === '' ? OAUTH_APP_CLIENT_ID_VAR : OAUTH_APP_CLIENT_SECRET_VAR;

    throw new Error(`${missing} is missing or blank: set both OAuth App variables, or neither`);
  }

  if (!OAUTH_APP_CLIENT_ID_PATTERN.test(clientId)) {
    throw new Error(`${OAUTH_APP_CLIENT_ID_VAR} must be 1-100 characters of [A-Za-z0-9._-]`);
  }

  return {
    enabled: true,
    clientId,
    clientSecret: new Secret(clientSecret),
    callbackUrl: buildCallbackUrl(configService),
  };
}

/**
 * Derives the callback URL from `FRONTEND_BASE_URL`'s origin.
 * @param {ConfigService} configService - Supplies `FRONTEND_BASE_URL` and `NODE_ENV`.
 * @returns {string} The callback URL.
 */
function buildCallbackUrl(configService: ConfigService): string {
  const origin = parseOrigin(readTrimmed(configService, FRONTEND_BASE_URL_VAR));
  const isProduction = readTrimmed(configService, 'NODE_ENV') === 'production';

  if (isProduction && origin.protocol !== 'https:') {
    throw new Error(`${FRONTEND_BASE_URL_VAR} must be https when NODE_ENV=production and the OAuth App is enabled`);
  }

  return `${origin.origin}${OAUTH_APP_CALLBACK_PATH}`;
}

/**
 * Parses `FRONTEND_BASE_URL`, requiring an http(s) URL.
 * @param {string} raw - The trimmed `FRONTEND_BASE_URL` value.
 * @returns {URL} The parsed URL.
 */
function parseOrigin(raw: string): URL {
  const problem = `${FRONTEND_BASE_URL_VAR} must be a valid http(s) URL when the OAuth App is enabled`;
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

/**
 * Reads a config value, trimmed, defaulting to `''`.
 * @param {ConfigService} configService - The config source.
 * @param {string} key - The variable name.
 * @returns {string} The trimmed value.
 */
function readTrimmed(configService: ConfigService, key: string): string {
  return (configService.get<string>(key) ?? '').trim();
}
