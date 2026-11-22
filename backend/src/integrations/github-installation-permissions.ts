/**
 * The permission sets a GitHub App installation token is minted with, one per
 * kind of operation, and the stable key a token is cached under. Internal to
 * the Integrations module.
 */

/** The permissions an installation token is minted with. */
export type InstallationPermissionSet = Readonly<Record<string, 'read' | 'write'>>;

/** The permission set of the repo listings. */
export const REPO_LISTING_PERMISSIONS: InstallationPermissionSet = { metadata: 'read' };
/** The permission set of `getIssue` and `probeIssues`. */
export const ISSUE_READ_PERMISSIONS: InstallationPermissionSet = { issues: 'read', metadata: 'read' };
/** The permission set of `updateIssue`. */
export const ISSUE_WRITE_PERMISSIONS: InstallationPermissionSet = { issues: 'write' };

/**
 * A stable key of a permission set, such as `issues:read,metadata:read`.
 * @param {InstallationPermissionSet} permissions - The permission set.
 * @returns {string} The key, independent of the order the permissions were written in.
 */
export function permissionKey(permissions: InstallationPermissionSet): string {
  return Object.entries(permissions)
    .map(([name, level]) => `${name}:${level}`)
    .sort()
    .join(',');
}
