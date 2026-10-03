import {
  GITHUB_ACCOUNT_LOGIN_PATTERN,
  GithubAccountType,
  GithubAppInstallation,
  GithubRepositorySelection,
  isPositiveId,
} from '../../github-app-client.service.js';
import { InvalidMetadataError } from '../../integration-errors.js';

/** A granted permission level the type accepts. */
export type GithubAppPermissionLevel = 'read' | 'write';

/** The `github_app` metadata shape. */
export interface GithubAppMetadata {
  installationId: number;
  appId: number;
  accountLogin: string;
  accountType: GithubAccountType;
  repositorySelection: GithubRepositorySelection;
  permissions: { issues: GithubAppPermissionLevel; metadata: GithubAppPermissionLevel };
  verifiedBy: string;
  [key: string]: unknown;
}

const METADATA_KEYS = [
  'accountLogin', 'accountType', 'appId', 'installationId', 'permissions', 'repositorySelection', 'verifiedBy',
].join(',');
const PERMISSION_KEYS = 'issues,metadata';
const ACCOUNT_TYPES: readonly unknown[] = ['User', 'Organization'];
const REPOSITORY_SELECTIONS: readonly unknown[] = ['all', 'selected'];
const PERMISSION_LEVELS: readonly unknown[] = ['read', 'write'];

/**
 * Whether a value is a GitHub login (1–39 characters of `[A-Za-z0-9-]`).
 * @param {unknown} login - The candidate login.
 * @returns {boolean} Whether it is one.
 */
export function isGithubLogin(login: unknown): login is string {
  return typeof login === 'string' && GITHUB_ACCOUNT_LOGIN_PATTERN.test(login);
}

/**
 * Whether an installation grants Issues and Metadata, each `read` or `write`.
 * @param {GithubAppInstallation['permissions']} permissions - The installation's permissions.
 * @returns {boolean} Whether both are granted.
 */
export function hasRequiredPermissions(permissions: GithubAppInstallation['permissions']): boolean {
  return PERMISSION_LEVELS.includes(permissions.issues) && PERMISSION_LEVELS.includes(permissions.metadata);
}

/**
 * Builds the metadata of a checked installation. The caller has already
 * checked the permissions (`hasRequiredPermissions`) and the verifying login.
 * @param {GithubAppInstallation} installation - The installation, as GitHub answered it.
 * @param {string} verifiedBy - The GitHub login that proved access.
 * @returns {GithubAppMetadata} The metadata (validated by `describeGithubAppMetadata`).
 */
export function buildGithubAppMetadata(installation: GithubAppInstallation, verifiedBy: string): GithubAppMetadata {
  return describeGithubAppMetadata({
    installationId: installation.installationId,
    appId: installation.appId,
    accountLogin: installation.accountLogin,
    accountType: installation.accountType,
    repositorySelection: installation.repositorySelection,
    permissions: { issues: installation.permissions.issues, metadata: installation.permissions.metadata },
    verifiedBy,
  });
}

/**
 * Validates the strict seven-key `github_app` metadata shape, returning a
 * copy. It never holds anything usable as a credential.
 * @param {unknown} metadata - The candidate metadata.
 * @returns {GithubAppMetadata} A copy.
 */
export function describeGithubAppMetadata(metadata: unknown): GithubAppMetadata {
  const candidate = asObject(metadata);

  if (candidate === null || Object.keys(candidate).sort().join(',') !== METADATA_KEYS
    || !hasValidIdentity(candidate) || !hasValidGrant(candidate)) {
    throw new InvalidMetadataError('github_app');
  }

  const permissions = candidate.permissions as GithubAppMetadata['permissions'];

  return {
    installationId: candidate.installationId as number,
    appId: candidate.appId as number,
    accountLogin: candidate.accountLogin as string,
    accountType: candidate.accountType as GithubAccountType,
    repositorySelection: candidate.repositorySelection as GithubRepositorySelection,
    permissions: { issues: permissions.issues, metadata: permissions.metadata },
    verifiedBy: candidate.verifiedBy as string,
  };
}

/**
 * Checks the ids, logins and account type.
 * @param {Record<string, unknown>} candidate - The metadata.
 * @returns {boolean} Whether they are valid.
 */
function hasValidIdentity(candidate: Record<string, unknown>): boolean {
  return isPositiveId(candidate.installationId) && isPositiveId(candidate.appId)
    && isGithubLogin(candidate.accountLogin) && isGithubLogin(candidate.verifiedBy)
    && ACCOUNT_TYPES.includes(candidate.accountType);
}

/**
 * Checks the repository selection and the exact two-key permissions object.
 * @param {Record<string, unknown>} candidate - The metadata.
 * @returns {boolean} Whether they are valid.
 */
function hasValidGrant(candidate: Record<string, unknown>): boolean {
  const permissions = asObject(candidate.permissions);

  return REPOSITORY_SELECTIONS.includes(candidate.repositorySelection)
    && permissions !== null
    && Object.keys(permissions).sort().join(',') === PERMISSION_KEYS
    && PERMISSION_LEVELS.includes(permissions.issues)
    && PERMISSION_LEVELS.includes(permissions.metadata);
}

/**
 * Narrows a value to a plain object.
 * @param {unknown} value - The value.
 * @returns {Record<string, unknown> | null} The object, or `null`.
 */
function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
