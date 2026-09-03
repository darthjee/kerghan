import { ConfigService } from '@nestjs/config';

// Default SMTP submission port, used when `KERGHAN_EMAIL_PORT` is unset/blank.
const DEFAULT_EMAIL_PORT = 587;
// Default per-phase SMTP timeout (ms), used when `KERGHAN_EMAIL_TIMEOUT_MS` is unset/blank.
const DEFAULT_EMAIL_TIMEOUT_MS = 10000;

/**
 * The object handed to `nodemailer.createTransport` — a local structural
 * subset of `SMTPTransport.Options` holding only the keys this module sets,
 * declared here so `mail.config.ts` need not deep-import nodemailer's own
 * type (awkward under NodeNext) and stays free of any nodemailer import.
 */
export interface TransportOptions {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  auth?: { user: string; pass: string };
  connectionTimeout: number;
  greetingTimeout: number;
  socketTimeout: number;
}

/**
 * Frozen, plain-data outbound-email configuration resolved once at boot
 * from the `KERGHAN_EMAIL_*` env vars. When disabled, `transport` is
 * `null` and `from` is `''`.
 */
export interface MailConfig {
  enabled: boolean;
  from: string;
  transport: TransportOptions | null;
}

// The single shared instance returned whenever email is disabled.
const DISABLED_MAIL_CONFIG: MailConfig = Object.freeze({
  enabled: false,
  from: '',
  transport: null,
});

/**
 * Validated primitive inputs to `buildTransportOptions`.
 */
export interface TransportOptionsInput {
  host: string;
  port: number;
  user: string;
  pass: string;
  useTls: boolean;
  timeoutMs: number;
}

/**
 * Builds the frozen {@link MailConfig} from `KERGHAN_EMAIL_*`. Called once
 * by `mail.module.ts`'s `useFactory` so there are no hidden env reads
 * inside `MailService`. Pure apart from the `ConfigService` reads, so it is
 * unit-testable without booting the app.
 * @param {ConfigService} configService - Supplies the `KERGHAN_EMAIL_*` values.
 * @returns {MailConfig} The frozen config: a disabled placeholder when
 *   `KERGHAN_EMAILS_ENABLED` is not exactly `'true'`, otherwise an enabled
 *   config carrying resolved transport options.
 * @throws {Error} When email is enabled but required vars are missing or
 *   set to an invalid value.
 */
export function buildMailConfig(configService: ConfigService): MailConfig {
  const enabled = configService.get<string>('KERGHAN_EMAILS_ENABLED') === 'true';

  if (!enabled) {
    return DISABLED_MAIL_CONFIG;
  }

  const host = readTrimmed(configService, 'KERGHAN_EMAIL_HOST');
  const from = readTrimmed(configService, 'KERGHAN_EMAIL_FROM');
  const portRaw = readTrimmed(configService, 'KERGHAN_EMAIL_PORT');
  const timeoutRaw = readTrimmed(configService, 'KERGHAN_EMAIL_TIMEOUT_MS');
  const port = parseOptionalNumber(portRaw, DEFAULT_EMAIL_PORT);
  const timeoutMs = parseOptionalNumber(timeoutRaw, DEFAULT_EMAIL_TIMEOUT_MS);

  const invalid = collectInvalid({ host, from, portRaw, port, timeoutRaw, timeoutMs });

  if (invalid.length > 0) {
    throw new Error(
      `mail: KERGHAN_EMAILS_ENABLED is true but the following are missing/invalid: ${invalid.join(', ')}`,
    );
  }

  const user = readTrimmed(configService, 'KERGHAN_EMAIL_USER');
  const pass = readTrimmed(configService, 'KERGHAN_EMAIL_PASSWORD');
  const useTls = (configService.get<string>('KERGHAN_EMAIL_USE_TLS') ?? 'true') !== 'false';

  return Object.freeze({
    enabled: true,
    from,
    transport: buildTransportOptions({ host, port, user, pass, useTls, timeoutMs }),
  });
}

/**
 * Maps validated primitives to the nodemailer transport-options shape.
 * @param {TransportOptionsInput} input - The validated host/port/credentials/timeout.
 * @returns {TransportOptions} Options for `nodemailer.createTransport`;
 *   `auth` is present only when both `user` and `pass` are non-empty.
 */
export function buildTransportOptions(input: TransportOptionsInput): TransportOptions {
  const { host, port, user, pass, useTls, timeoutMs } = input;

  const options: TransportOptions = {
    host,
    port,
    secure: port === 465,
    requireTLS: useTls && port !== 465,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
  };

  if (user && pass) {
    options.auth = { user, pass };
  }

  return options;
}

/**
 * Reads a string env var and trims it.
 * @param {ConfigService} configService - Source of the raw value.
 * @param {string} name - The env var name.
 * @returns {string} The trimmed value, or `''` when unset.
 */
function readTrimmed(configService: ConfigService, name: string): string {
  return (configService.get<string>(name) ?? '').trim();
}

/**
 * Parses an optional numeric env var.
 * @param {string} raw - The already-trimmed raw value (`''` when unset).
 * @param {number} fallback - Returned when `raw` is `''`.
 * @returns {number} The fallback when unset, `Number(raw)` otherwise (may
 *   be `NaN`, which the caller flags as invalid).
 */
function parseOptionalNumber(raw: string, fallback: number): number {
  if (raw === '') {
    return fallback;
  }

  return Number(raw);
}

/**
 * Collects the names of every required var that is missing and every
 * optional numeric var that was set but did not parse to a positive
 * finite number.
 * @param {object} input - The resolved candidate values.
 * @param {string} input.host - Resolved `KERGHAN_EMAIL_HOST`.
 * @param {string} input.from - Resolved `KERGHAN_EMAIL_FROM`.
 * @param {string} input.portRaw - Raw trimmed `KERGHAN_EMAIL_PORT`.
 * @param {number} input.port - Parsed port.
 * @param {string} input.timeoutRaw - Raw trimmed `KERGHAN_EMAIL_TIMEOUT_MS`.
 * @param {number} input.timeoutMs - Parsed timeout.
 * @returns {string[]} The offending env var names, empty when all valid.
 */
function collectInvalid(input: {
  host: string;
  from: string;
  portRaw: string;
  port: number;
  timeoutRaw: string;
  timeoutMs: number;
}): string[] {
  const invalid: string[] = [];

  if (!input.host) {
    invalid.push('KERGHAN_EMAIL_HOST');
  }

  if (!input.from) {
    invalid.push('KERGHAN_EMAIL_FROM');
  }

  if (input.portRaw !== '' && !isPositiveFinite(input.port)) {
    invalid.push('KERGHAN_EMAIL_PORT');
  }

  if (input.timeoutRaw !== '' && !isPositiveFinite(input.timeoutMs)) {
    invalid.push('KERGHAN_EMAIL_TIMEOUT_MS');
  }

  return invalid;
}

/**
 * @param {number} value - The number to test.
 * @returns {boolean} `true` when `value` is finite and greater than zero.
 */
function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
