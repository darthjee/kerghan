import { BlockList, isIP } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
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

// Matches an IPv4-mapped IPv6 address (`::ffff:a.b.c.d`), capturing the IPv4 tail.
const IPV4_MAPPED_PATTERN = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;
// Matches a decimal CIDR prefix length.
const PREFIX_PATTERN = /^\d{1,3}$/;
// Maximum CIDR prefix length per IP family (`isIP`'s return value).
const MAX_PREFIX: Record<number, number> = { 4: 32, 6: 128 };

/** One parsed `ALLOWED_IPS` entry: a single address or a CIDR range. */
interface AllowlistRule {
  address: string;
  family: 'ipv4' | 'ipv6';
  prefix: number | null;
}

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

    this.#blockList = buildBlockList(this.#settings.allowedIps);
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
    const address = normalizeIp(ip.trim());
    const family = isIP(address);

    if (family === 0) {
      return false;
    }

    return this.#blockList.check(address, family === 4 ? 'ipv4' : 'ipv6');
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
      .filter((entry) => parseRule(entry) === null)
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

/**
 * Parses one allowlist entry: a bare IP or `ip/prefix` with an in-range
 * integer prefix.
 * @param {string} entry - The trimmed entry.
 * @returns {AllowlistRule | null} The rule, or `null` when malformed.
 */
function parseRule(entry: string): AllowlistRule | null {
  const [address, prefixRaw, ...rest] = entry.split('/');
  const familyNumber = isIP(address);

  if (familyNumber === 0 || rest.length > 0) {
    return null;
  }

  const family = familyNumber === 4 ? 'ipv4' : 'ipv6';

  if (prefixRaw === undefined) {
    return { address, family, prefix: null };
  }

  const prefix = Number(prefixRaw);

  if (!PREFIX_PATTERN.test(prefixRaw) || prefix > MAX_PREFIX[familyNumber]) {
    return null;
  }

  return { address, family, prefix };
}

/**
 * Builds the allowlist from the well-formed entries; loopback only
 * (`127.0.0.1`, `::1`) when there are none.
 * @param {string[]} entries - The trimmed, non-empty allowlist entries.
 * @returns {BlockList} The allowlist (a `BlockList` used as an allow set).
 */
function buildBlockList(entries: string[]): BlockList {
  const blockList = new BlockList();
  const rules = entries
    .map(parseRule)
    .filter((rule): rule is AllowlistRule => rule !== null);

  if (rules.length === 0) {
    blockList.addAddress('127.0.0.1', 'ipv4');
    blockList.addAddress('::1', 'ipv6');
    return blockList;
  }

  for (const rule of rules) {
    if (rule.prefix === null) {
      blockList.addAddress(rule.address, rule.family);
    } else {
      blockList.addSubnet(rule.address, rule.prefix, rule.family);
    }
  }

  return blockList;
}

/**
 * Maps an IPv4-mapped IPv6 address (`::ffff:a.b.c.d`) to its IPv4 form.
 * @param {string} ip - The trimmed client IP.
 * @returns {string} The IPv4 tail when `ip` is IPv4-mapped, `ip` otherwise.
 */
function normalizeIp(ip: string): string {
  const match = IPV4_MAPPED_PATTERN.exec(ip);

  return match && isIP(match[1]) === 4 ? match[1] : ip;
}
