import { createPrivateKey, KeyObject } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Secret } from '../../secret.js';
import { buildCallbackUrl, readTrimmed } from '../shared/redirect-config.js';

// Env var holding the GitHub App's numeric id.
export const GITHUB_APP_ID_VAR = 'KERGHAN_GITHUB_APP_ID';
// Env var holding the GitHub App's URL slug.
export const GITHUB_APP_SLUG_VAR = 'KERGHAN_GITHUB_APP_SLUG';
// Env var holding the base64 of the GitHub App's PEM private key.
export const GITHUB_APP_PRIVATE_KEY_VAR = 'KERGHAN_GITHUB_APP_PRIVATE_KEY';
// Env var holding the GitHub App's client id.
export const GITHUB_APP_CLIENT_ID_VAR = 'KERGHAN_GITHUB_APP_CLIENT_ID';
// Env var holding the GitHub App's client secret.
export const GITHUB_APP_CLIENT_SECRET_VAR = 'KERGHAN_GITHUB_APP_CLIENT_SECRET';

// The five variables, all set or all unset.
export const GITHUB_APP_VARS = [
  GITHUB_APP_ID_VAR,
  GITHUB_APP_SLUG_VAR,
  GITHUB_APP_PRIVATE_KEY_VAR,
  GITHUB_APP_CLIENT_ID_VAR,
  GITHUB_APP_CLIENT_SECRET_VAR,
] as const;

// Path (on the frontend origin) GitHub redirects the browser back to.
export const GITHUB_APP_CALLBACK_PATH = '/integrations/github_app/callback';

// Shape of a valid GitHub App slug.
export const GITHUB_APP_SLUG_PATTERN = /^[a-z0-9-]{1,100}$/;
// Shape of a valid GitHub App client id.
export const GITHUB_APP_CLIENT_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
// Shape of a valid GitHub App id (a positive integer, no leading zero).
const APP_ID_PATTERN = /^[1-9][0-9]{0,15}$/;
// Human name used in boot error messages.
const TYPE_NAME = 'GitHub App';

/**
 * DI token under which the validated GitHub App config is provided.
 */
export const GITHUB_APP_CONFIG = Symbol('GITHUB_APP_CONFIG');

/**
 * The GitHub App config when the type is disabled (all five variables unset or blank).
 */
export interface DisabledGithubAppConfig {
  enabled: false;
}

/**
 * The GitHub App config when the type is enabled.
 * @property {number} appId - The app id.
 * @property {string} slug - The app's URL slug.
 * @property {Secret<KeyObject>} privateKey - The parsed RSA private key.
 * @property {string} clientId - The app's client id (public).
 * @property {Secret<string>} clientSecret - The app's client secret.
 * @property {string} callbackUrl - Origin of `FRONTEND_BASE_URL` plus the callback path.
 */
export interface EnabledGithubAppConfig {
  enabled: true;
  appId: number;
  slug: string;
  privateKey: Secret<KeyObject>;
  clientId: string;
  clientSecret: Secret<string>;
  callbackUrl: string;
}

export type GithubAppConfig = DisabledGithubAppConfig | EnabledGithubAppConfig;

/**
 * Reads and validates the GitHub App config at boot. Throws (failing Nest's
 * boot) when only some of the five variables are set, a value is malformed,
 * or — when enabled — `FRONTEND_BASE_URL` is missing, unparseable, or not
 * `https` under `NODE_ENV=production`. Errors name the variables, never
 * their values.
 * @param {ConfigService} configService - Supplies the five variables, `FRONTEND_BASE_URL` and `NODE_ENV`.
 * @returns {GithubAppConfig} `{ enabled: false }`, or the enabled config.
 */
export function buildGithubAppConfig(configService: ConfigService): GithubAppConfig {
  const values = Object.fromEntries(GITHUB_APP_VARS.map((key) => [key, readTrimmed(configService, key)]));
  const missing = GITHUB_APP_VARS.filter((key) => values[key] === '');

  if (missing.length === GITHUB_APP_VARS.length) {
    return { enabled: false };
  }

  if (missing.length > 0) {
    throw new Error(`${missing.join(', ')} missing or blank: set all five GitHub App variables, or none`);
  }

  return {
    enabled: true,
    appId: parseAppId(values[GITHUB_APP_ID_VAR]),
    slug: checkPattern(values[GITHUB_APP_SLUG_VAR], GITHUB_APP_SLUG_PATTERN, GITHUB_APP_SLUG_VAR, '[a-z0-9-]'),
    privateKey: new Secret(parsePrivateKey(values[GITHUB_APP_PRIVATE_KEY_VAR])),
    clientId: checkPattern(
      values[GITHUB_APP_CLIENT_ID_VAR], GITHUB_APP_CLIENT_ID_PATTERN, GITHUB_APP_CLIENT_ID_VAR, '[A-Za-z0-9._-]',
    ),
    clientSecret: new Secret(values[GITHUB_APP_CLIENT_SECRET_VAR]),
    callbackUrl: buildCallbackUrl(configService, GITHUB_APP_CALLBACK_PATH, TYPE_NAME),
  };
}

/**
 * Parses the app id, a positive integer.
 * @param {string} raw - The trimmed value.
 * @returns {number} The app id.
 */
function parseAppId(raw: string): number {
  if (!APP_ID_PATTERN.test(raw) || !Number.isSafeInteger(Number(raw))) {
    throw new Error(`${GITHUB_APP_ID_VAR} must be a positive integer`);
  }

  return Number(raw);
}

/**
 * Checks a value against its pattern.
 * @param {string} raw - The trimmed value.
 * @param {RegExp} pattern - The required shape.
 * @param {string} variable - The variable name, for the error.
 * @param {string} charset - Human description of the allowed characters.
 * @returns {string} The value, unchanged.
 */
function checkPattern(raw: string, pattern: RegExp, variable: string, charset: string): string {
  if (!pattern.test(raw)) {
    throw new Error(`${variable} must be 1-100 characters of ${charset}`);
  }

  return raw;
}

/**
 * Decodes the base64 PEM and parses it as an RSA private key. The error
 * never includes the key material or the parser's message.
 * @param {string} raw - The trimmed base64 value.
 * @returns {KeyObject} The parsed private key.
 */
function parsePrivateKey(raw: string): KeyObject {
  const problem = `${GITHUB_APP_PRIVATE_KEY_VAR} must be the base64 of an RSA private key PEM`;
  let key: KeyObject;

  try {
    key = createPrivateKey(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    throw new Error(problem);
  }

  if (key.asymmetricKeyType !== 'rsa') {
    throw new Error(problem);
  }

  return key;
}
