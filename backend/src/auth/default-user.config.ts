import { BlockList } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import {
  buildAllowlist,
  effectiveAllowlistEntries,
  isInAllowlist,
  parseAllowlistEntry,
} from './default-user-allowlist.js';
import { PASSWORD_MIN_LENGTH } from './password-rules.js';

// Env var names — `DefaultUserConfig` is their only reader.
const ENABLED = 'KERGHAN_DEFAULT_USER_ENABLED';
const ALWAYS_AUTHENTICATED = 'KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED';
const USERNAME = 'KERGHAN_DEFAULT_USER_USERNAME';
const EMAIL = 'KERGHAN_DEFAULT_USER_EMAIL';
const PASSWORD = 'KERGHAN_DEFAULT_USER_PASSWORD';
const ADMIN = 'KERGHAN_DEFAULT_USER_ADMIN';
const ALLOWED_IPS = 'KERGHAN_DEFAULT_USER_ALLOWED_IPS';
const ALLOW_IN_PRODUCTION = 'KERGHAN_DEFAULT_USER_ALLOW_IN_PRODUCTION';

/**
 * The raw-but-normalized values read from `KERGHAN_DEFAULT_USER_*` (and
 * `STAGE`): flags already resolved to booleans (exact `'true'`), username,
 * email and allowlist entries trimmed, password verbatim.
 */
export interface DefaultUserSettings {
  enabled: boolean;
  alwaysAuthenticated: boolean;
  username: string;
  email: string;
  password: string;
  admin: boolean;
  allowedIps: string[];
  allowInProduction: boolean;
  stage: string;
}

/**
 * The single reader of the `KERGHAN_DEFAULT_USER_*` env vars. Built once at
 * boot (see `auth.module.ts`'s factory provider), it validates on
 * construction — collecting every problem into one error — and exposes the
 * resolved values through methods. Follows the `buildMailConfig` precedent
 * in `mail/mail.config.ts`. The password never appears in any error message.
 */
export class DefaultUserConfig {
  readonly #settings: DefaultUserSettings;
  readonly #blockList: BlockList;

  /**
   * Validates `settings` (only when the feature is enabled) and builds the
   * IP allowlist.
   * @param {DefaultUserSettings} settings - The normalized env values.
   * @throws {Error} When enabled and any value is missing/invalid, naming
   *   every offending variable (and allowlist entry) in a single message.
   */
  constructor(settings: DefaultUserSettings) {
    this.#settings = Object.freeze({ ...settings, allowedIps: [...settings.allowedIps] });

    if (this.isEnabled()) {
      throwIfInvalid(collectInvalid(this.#settings));
    }

    this.#blockList = buildAllowlist(this.#settings.allowedIps);
  }

  /**
   * Reads every `KERGHAN_DEFAULT_USER_*` variable (plus `STAGE`) once and
   * builds a validated {@link DefaultUserConfig}.
   * @param {ConfigService} configService - Supplies the env values.
   * @returns {DefaultUserConfig} The validated config.
   * @throws {Error} When the feature is enabled and the configuration is invalid.
   */
  static fromConfigService(configService: ConfigService): DefaultUserConfig {
    return new DefaultUserConfig(readSettings(configService));
  }

  /**
   * @returns {boolean} `true` when `ENABLED` or `ALWAYS_AUTHENTICATED` is on
   *   (always-authenticated implies enabled).
   */
  isEnabled(): boolean {
    return this.#settings.enabled || this.#settings.alwaysAuthenticated;
  }

  /**
   * @returns {boolean} Whether clients with no valid session are logged in
   *   automatically as the default user.
   */
  isAlwaysAuthenticated(): boolean {
    return this.#settings.alwaysAuthenticated;
  }

  /**
   * @returns {string} The configured (trimmed) default username.
   */
  username(): string {
    return this.#settings.username;
  }

  /**
   * @returns {string} The configured (trimmed) default user email.
   */
  email(): string {
    return this.#settings.email;
  }

  /**
   * @returns {string} The configured default user password, verbatim.
   */
  password(): string {
    return this.#settings.password;
  }

  /**
   * @returns {boolean} Whether the default user is an admin; `false` when
   *   `ADMIN` is unset.
   */
  isAdmin(): boolean {
    return this.#settings.admin;
  }

  /**
   * Checks an already-resolved client IP against the allowlist (loopback
   * only when `ALLOWED_IPS` is empty/unset). IPv4-mapped IPv6 addresses
   * (`::ffff:a.b.c.d`) are matched as their IPv4 form.
   * @param {string} ip - The resolved client IP.
   * @returns {boolean} `true` when `ip` is a valid IP inside the allowlist.
   */
  isIpAllowed(ip: string): boolean {
    return isInAllowlist(this.#blockList, ip);
  }

  /**
   * @returns {string[]} The effective allowlist: the configured entries, or
   *   the loopback defaults (`127.0.0.1`, `::1`) when none are configured.
   */
  allowedIps(): string[] {
    return effectiveAllowlistEntries(this.#settings.allowedIps);
  }
}

/**
 * @param {ConfigService} configService - Source of the env values.
 * @returns {DefaultUserSettings} The normalized settings.
 */
function readSettings(configService: ConfigService): DefaultUserSettings {
  const read = (name: string): string => configService.get<string>(name) ?? '';
  const flag = (name: string): boolean => configService.get<string>(name) === 'true';

  return {
    enabled: flag(ENABLED),
    alwaysAuthenticated: flag(ALWAYS_AUTHENTICATED),
    username: read(USERNAME).trim(),
    email: read(EMAIL).trim(),
    password: read(PASSWORD),
    admin: flag(ADMIN),
    allowedIps: read(ALLOWED_IPS).split(',').map((entry) => entry.trim()).filter(Boolean),
    allowInProduction: flag(ALLOW_IN_PRODUCTION),
    stage: read('STAGE'),
  };
}

/**
 * Collects every validation problem, never including the password value.
 * @param {DefaultUserSettings} settings - The normalized settings.
 * @returns {string[]} One description per problem, empty when valid.
 */
function collectInvalid(settings: DefaultUserSettings): string[] {
  return [
    ...collectCredentialsInvalid(settings),
    ...settings.allowedIps
      .filter((entry) => parseAllowlistEntry(entry) === null)
      .map((entry) => `${ALLOWED_IPS} (malformed entry "${entry}")`),
    ...collectProductionInvalid(settings),
  ];
}

/**
 * @param {DefaultUserSettings} settings - The normalized settings.
 * @returns {string[]} Problems with username, email and password.
 */
function collectCredentialsInvalid(settings: DefaultUserSettings): string[] {
  const invalid: string[] = [];

  if (!settings.username) {
    invalid.push(USERNAME);
  }

  if (!settings.email) {
    invalid.push(EMAIL);
  } else if (!isEmail(settings.email)) {
    invalid.push(`${EMAIL} (not a valid email)`);
  }

  if (!settings.password) {
    invalid.push(PASSWORD);
  } else if (settings.password.length < PASSWORD_MIN_LENGTH) {
    invalid.push(`${PASSWORD} (shorter than ${PASSWORD_MIN_LENGTH} characters)`);
  }

  return invalid;
}

/**
 * The production guard: always-authenticated may only boot in production
 * with an explicit opt-in.
 * @param {DefaultUserSettings} settings - The normalized settings.
 * @returns {string[]} The guard problem, or empty when it passes.
 */
function collectProductionInvalid(settings: DefaultUserSettings): string[] {
  const blocked = settings.stage === 'production'
    && settings.alwaysAuthenticated
    && !settings.allowInProduction;

  return blocked
    ? [`${ALLOW_IN_PRODUCTION} (must be true for ${ALWAYS_AUTHENTICATED} when STAGE=production)`]
    : [];
}

/**
 * @param {string[]} invalid - The collected problems.
 * @returns {void} Returns normally when `invalid` is empty.
 * @throws {Error} Naming every problem, when non-empty.
 */
function throwIfInvalid(invalid: string[]): void {
  if (invalid.length === 0) {
    return;
  }

  throw new Error(
    `default-user: the default user is enabled but the following are missing/invalid: ${invalid.join(', ')}`,
  );
}
