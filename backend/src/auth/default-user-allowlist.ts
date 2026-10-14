import { BlockList, isIP } from 'node:net';

// IP-allowlist helpers for `DefaultUserConfig` (`KERGHAN_DEFAULT_USER_ALLOWED_IPS`).
// Kept apart from `default-user.config.ts` so each file stays under the line limit.

// Matches an IPv4-mapped IPv6 address (`::ffff:a.b.c.d`), capturing the IPv4 tail.
const IPV4_MAPPED_PATTERN = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;
// Matches a decimal CIDR prefix length.
const PREFIX_PATTERN = /^\d{1,3}$/;
// Maximum CIDR prefix length per IP family (`isIP`'s return value).
const MAX_PREFIX: Record<number, number> = { 4: 32, 6: 128 };
// The allowlist used when no well-formed entry is configured.
const LOOPBACK_ADDRESSES = ['127.0.0.1', '::1'] as const;

/** One parsed `ALLOWED_IPS` entry: a single address or a CIDR range. */
export interface AllowlistRule {
  address: string;
  family: 'ipv4' | 'ipv6';
  prefix: number | null;
}

/**
 * Checks an already-resolved client IP against an allowlist built by
 * {@link buildAllowlist}. IPv4-mapped IPv6 addresses (`::ffff:a.b.c.d`) are
 * matched as their IPv4 form.
 * @param {BlockList} allowlist - The allowlist.
 * @param {string} ip - The resolved client IP.
 * @returns {boolean} `true` when `ip` is a valid IP inside the allowlist.
 */
export function isInAllowlist(allowlist: BlockList, ip: string): boolean {
  const address = normalizeIp(ip.trim());
  const family = isIP(address);

  if (family === 0) {
    return false;
  }

  return allowlist.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

/**
 * Parses one allowlist entry: a bare IP or `ip/prefix` with an in-range
 * integer prefix. IPv6 zone IDs (`fe80::1%eth0`) are malformed — `isIP`
 * accepts them but `BlockList` drops (or, on some Node versions, rejects)
 * the zone — as is any entry `BlockList` itself refuses.
 * @param {string} entry - The trimmed entry.
 * @returns {AllowlistRule | null} The rule, or `null` when malformed.
 */
export function parseAllowlistEntry(entry: string): AllowlistRule | null {
  const rule = parseRule(entry);

  return rule && addRule(new BlockList(), rule) ? rule : null;
}
/**
 * The entries that actually apply: the well-formed configured entries, or
 * the loopback defaults (`127.0.0.1`, `::1`) when there are none. Mirrors
 * {@link buildAllowlist}, so it reports exactly what is enforced.
 * @param {string[]} entries - The trimmed, non-empty allowlist entries.
 * @returns {string[]} The effective allowlist entries.
 */
export function effectiveAllowlistEntries(entries: string[]): string[] {
  const wellFormed = entries.filter((entry) => parseAllowlistEntry(entry) !== null);

  return wellFormed.length === 0 ? [...LOOPBACK_ADDRESSES] : wellFormed;
}

/**
 * Builds the allowlist from the well-formed entries; loopback only
 * (`127.0.0.1`, `::1`) when there are none.
 * @param {string[]} entries - The trimmed, non-empty allowlist entries.
 * @returns {BlockList} The allowlist (a `BlockList` used as an allow set).
 */
export function buildAllowlist(entries: string[]): BlockList {
  const blockList = new BlockList();
  const rules = entries
    .map(parseAllowlistEntry)
    .filter((rule): rule is AllowlistRule => rule !== null);

  if (rules.length === 0) {
    blockList.addAddress('127.0.0.1', 'ipv4');
    blockList.addAddress('::1', 'ipv6');
    return blockList;
  }

  for (const rule of rules) {
    addRule(blockList, rule);
  }

  return blockList;
}

/**
 * Syntactic parse of one entry (no `BlockList` involvement).
 * @param {string} entry - The trimmed entry.
 * @returns {AllowlistRule | null} The rule, or `null` when malformed.
 */
function parseRule(entry: string): AllowlistRule | null {
  const [address, prefixRaw, ...rest] = entry.split('/');
  const familyNumber = address.includes('%') ? 0 : isIP(address);

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
 * Adds `rule` to `blockList`, turning a `BlockList` rejection into `false`
 * so a bad entry can never crash boot.
 * @param {BlockList} blockList - The list to add to.
 * @param {AllowlistRule} rule - The parsed rule.
 * @returns {boolean} `true` when added, `false` when `BlockList` threw.
 */
function addRule(blockList: BlockList, rule: AllowlistRule): boolean {
  try {
    if (rule.prefix === null) {
      blockList.addAddress(rule.address, rule.family);
    } else {
      blockList.addSubnet(rule.address, rule.prefix, rule.family);
    }
    return true;
  } catch {
    return false;
  }
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
