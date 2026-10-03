import { Injectable } from '@nestjs/common';
import { apiHeaders, GITHUB_API_URL, send } from './github-client.service.js';
import { GithubRateLimitFields, parseJsonObject, rateLimitFields } from './github-http.js';
import { Secret } from './secret.js';

// Largest `GET /user/installations` body read: `per_page=100` answers can be hundreds of KiB.
export const GITHUB_INSTALLATIONS_MAX_BODY_BYTES = 1024 * 1024;
// First page of the user's installations.
export const GITHUB_USER_INSTALLATIONS_URL = `${GITHUB_API_URL}/user/installations?per_page=100`;
// Shape of a GitHub account login.
export const GITHUB_ACCOUNT_LOGIN_PATTERN = /^[A-Za-z0-9-]{1,39}$/;
// Matches the `rel="next"` target of a `Link` header.
const NEXT_LINK_PATTERN = /<([^>]+)>\s*;\s*rel="next"/;

/** The kind of account an installation belongs to. */
export type GithubAccountType = 'User' | 'Organization';

/** Which repositories an installation grants. */
export type GithubRepositorySelection = 'all' | 'selected';

/** One installation listed by `GET /user/installations`, reduced to what Kerghan uses. */
export interface GithubUserInstallation {
  installationId: number;
  appId: number;
  accountLogin: string;
  accountType: GithubAccountType;
}

/** One normalised page of `GET /user/installations`. */
export interface GithubInstallationsPage extends GithubRateLimitFields {
  status: number;
  /** The well-formed entries (200 only), or `null` when the body has no `installations` array. */
  installations: GithubUserInstallation[] | null;
  /** The `rel="next"` page URL, only when it is on `api.github.com`; else `null`. */
  nextUrl: string | null;
}

/** `GET /app/installations/{id}`, reduced to what Kerghan checks and records. */
export interface GithubAppInstallation extends GithubUserInstallation {
  repositorySelection: GithubRepositorySelection;
  permissions: { issues: string | null; metadata: string | null };
  suspended: boolean;
}

/** The normalised answer of `GET /app/installations/{id}`. */
export interface GithubAppInstallationResponse extends GithubRateLimitFields {
  status: number;
  /** The installation (200 with every expected field only), else `null`. */
  installation: GithubAppInstallation | null;
}

/** The normalised answer of `POST /app/installations/{id}/access_tokens` (the token is dropped). */
export interface GithubInstallationTokenResponse extends GithubRateLimitFields {
  status: number;
}

/**
 * The GitHub App calls (user installations, app-authenticated installation
 * lookup and token mint), split from `GithubClientService` but sharing its
 * safeguards (`send`: no redirects, timeout, capped body). Specs replace it
 * with the same fake (`tests/support/fake-github-client.ts`).
 *
 * The user token and the app JWT stay wrapped until the `Authorization`
 * header; the minted installation token is never parsed out of its body.
 */
@Injectable()
export class GithubAppClientService {
  /**
   * Fetches one page of `GET /user/installations` with a user-to-server token.
   * @param {Secret<string>} userToken - The user token.
   * @param {string} [pageUrl] - A `nextUrl` from a previous page; defaults to the first page.
   * @returns {Promise<GithubInstallationsPage>} GitHub's normalised answer, whatever its status.
   */
  async listUserInstallations(userToken: Secret<string>, pageUrl?: string): Promise<GithubInstallationsPage> {
    const { response, body } = await send(
      pageUrl ?? GITHUB_USER_INSTALLATIONS_URL,
      { method: 'GET', headers: apiHeaders(`Bearer ${userToken.reveal()}`) },
      GITHUB_INSTALLATIONS_MAX_BODY_BYTES,
    );

    return {
      status: response.status,
      installations: response.status === 200 ? parseInstallations(body) : null,
      nextUrl: response.status === 200 ? nextPageUrl(response.headers.get('link')) : null,
      ...rateLimitFields(response.headers),
    };
  }

  /**
   * Calls `GET /app/installations/{id}` with the app JWT.
   * @param {Secret<string>} jwt - The app JWT.
   * @param {number} installationId - The installation id.
   * @returns {Promise<GithubAppInstallationResponse>} GitHub's normalised answer, whatever its status.
   */
  async getAppInstallation(jwt: Secret<string>, installationId: number): Promise<GithubAppInstallationResponse> {
    const { response, body } = await send(
      `${GITHUB_API_URL}/app/installations/${installationId}`,
      { method: 'GET', headers: apiHeaders(`Bearer ${jwt.reveal()}`) },
    );

    return {
      status: response.status,
      installation: response.status === 200 ? parseAppInstallation(parseJsonObject(body)) : null,
      ...rateLimitFields(response.headers),
    };
  }

  /**
   * Calls `POST /app/installations/{id}/access_tokens` with the app JWT,
   * proving the private key can use the installation. The returned token is
   * never read out of the body, so it is dropped immediately.
   * @param {Secret<string>} jwt - The app JWT.
   * @param {number} installationId - The installation id.
   * @returns {Promise<GithubInstallationTokenResponse>} GitHub's status (201 on success) and rate-limit headers.
   */
  async createInstallationToken(jwt: Secret<string>, installationId: number): Promise<GithubInstallationTokenResponse> {
    const { response } = await send(
      `${GITHUB_API_URL}/app/installations/${installationId}/access_tokens`,
      { method: 'POST', headers: apiHeaders(`Bearer ${jwt.reveal()}`) },
    );

    return { status: response.status, ...rateLimitFields(response.headers) };
  }
}

/**
 * Whether a value is a positive safe integer.
 * @param {unknown} value - The value.
 * @returns {boolean} Whether it is one.
 */
export function isPositiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/**
 * Reads the `rel="next"` URL of a `Link` header, keeping it only when it
 * points at the API host (so the token is never sent anywhere else).
 * @param {string | null} link - The `Link` header.
 * @returns {string | null} The next page URL, or `null`.
 */
function nextPageUrl(link: string | null): string | null {
  const next = link === null ? null : NEXT_LINK_PATTERN.exec(link)?.[1] ?? null;

  return next !== null && next.startsWith(`${GITHUB_API_URL}/`) ? next : null;
}

/**
 * Parses the `installations` array of a `GET /user/installations` body,
 * dropping malformed entries.
 * @param {string | null} body - The body text, or `null` when it was too large.
 * @returns {GithubUserInstallation[] | null} The entries, or `null` without an array.
 */
function parseInstallations(body: string | null): GithubUserInstallation[] | null {
  const { installations } = parseJsonObject(body);

  if (!Array.isArray(installations)) {
    return null;
  }

  return installations
    .map((entry: unknown) => parseInstallation(asObject(entry)))
    .filter((entry): entry is GithubUserInstallation => entry !== null);
}

/**
 * Parses the fields shared by both installation shapes.
 * @param {Record<string, unknown>} raw - The installation object.
 * @returns {GithubUserInstallation | null} The installation, or `null` when malformed.
 */
function parseInstallation(raw: Record<string, unknown>): GithubUserInstallation | null {
  const account = asObject(raw.account);
  const { login, type } = account;

  if (!isPositiveId(raw.id) || !isPositiveId(raw.app_id) || typeof login !== 'string'
    || !GITHUB_ACCOUNT_LOGIN_PATTERN.test(login) || (type !== 'User' && type !== 'Organization')) {
    return null;
  }

  return { installationId: raw.id, appId: raw.app_id, accountLogin: login, accountType: type };
}

/**
 * Parses a `GET /app/installations/{id}` body.
 * @param {Record<string, unknown>} raw - The parsed body.
 * @returns {GithubAppInstallation | null} The installation, or `null` when a field is missing or malformed.
 */
function parseAppInstallation(raw: Record<string, unknown>): GithubAppInstallation | null {
  const base = parseInstallation(raw);
  const selection = raw.repository_selection;
  const suspendedAt = raw.suspended_at ?? null;

  if (base === null || (selection !== 'all' && selection !== 'selected')
    || (suspendedAt !== null && typeof suspendedAt !== 'string')) {
    return null;
  }

  const permissions = asObject(raw.permissions);

  return {
    ...base,
    repositorySelection: selection,
    permissions: { issues: stringOrNull(permissions.issues), metadata: stringOrNull(permissions.metadata) },
    suspended: suspendedAt !== null,
  };
}

/**
 * Narrows a value to a plain object.
 * @param {unknown} value - The value.
 * @returns {Record<string, unknown>} The object, or `{}`.
 */
function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/**
 * Keeps a string value.
 * @param {unknown} value - The value.
 * @returns {string | null} The string, or `null`.
 */
function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
