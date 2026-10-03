import { ConfigService } from '@nestjs/config';
import { Secret } from '../../secret.js';
import { buildCallbackUrl, readTrimmed } from '../shared/redirect-config.js';

// Env var holding the OAuth App's client id.
export const OAUTH_APP_CLIENT_ID_VAR = 'KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID';
// Env var holding the OAuth App's client secret.
export const OAUTH_APP_CLIENT_SECRET_VAR = 'KERGHAN_GITHUB_OAUTH_APP_CLIENT_SECRET';
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
    callbackUrl: buildCallbackUrl(configService, OAUTH_APP_CALLBACK_PATH, 'OAuth App'),
  };
}
