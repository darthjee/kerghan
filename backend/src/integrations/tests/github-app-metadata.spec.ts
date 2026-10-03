import type { GithubAppInstallation } from '../github-app-client.service.js';
import { InvalidMetadataError } from '../integration-errors.js';
import { appInstallationResponse } from './support/fake-github-answers.js';
import {
  buildGithubAppMetadata,
  describeGithubAppMetadata,
  hasRequiredPermissions,
  isGithubLogin,
} from '../types/github-app/github-app-metadata.js';

const VALID = {
  installationId: 12345678,
  appId: 123456,
  accountLogin: 'acme',
  accountType: 'Organization',
  repositorySelection: 'selected',
  permissions: { issues: 'read', metadata: 'read' },
  verifiedBy: 'octocat',
};

describe('github-app metadata', () => {
  it('builds the metadata from an installation and the verifying login', () => {
    const installation = appInstallationResponse().installation as GithubAppInstallation;

    expect(buildGithubAppMetadata(installation, 'octocat')).toEqual(VALID);
  });

  it('accepts the valid shape, returning a copy', () => {
    const described = describeGithubAppMetadata(VALID);

    expect(described).toEqual(VALID);
    expect(described).not.toBe(VALID);
  });

  it('accepts write permissions and all repositories', () => {
    const metadata = { ...VALID, repositorySelection: 'all', permissions: { issues: 'write', metadata: 'write' } };

    expect(describeGithubAppMetadata(metadata)).toEqual(metadata);
  });

  it.each([
    ['an extra key', { ...VALID, token: 'ghs_x' }],
    ['a missing key', (({ verifiedBy: _ignored, ...rest }) => rest)(VALID)],
    ['a string installation id', { ...VALID, installationId: '1' }],
    ['a zero app id', { ...VALID, appId: 0 }],
    ['an unsafe installation id', { ...VALID, installationId: 2 ** 53 }],
    ['a bad account login', { ...VALID, accountLogin: 'a b' }],
    ['a too long account login', { ...VALID, accountLogin: 'a'.repeat(40) }],
    ['a bad verifying login', { ...VALID, verifiedBy: '' }],
    ['an Enterprise account', { ...VALID, accountType: 'Enterprise' }],
    ['a bad repository selection', { ...VALID, repositorySelection: 'none' }],
    ['an admin permission', { ...VALID, permissions: { issues: 'admin', metadata: 'read' } }],
    ['an extra permission', { ...VALID, permissions: { issues: 'read', metadata: 'read', contents: 'read' } }],
    ['a missing permission', { ...VALID, permissions: { issues: 'read' } }],
    ['a non-object permissions', { ...VALID, permissions: ['read'] }],
    ['an array', [VALID]],
    ['null', null],
  ])('rejects %s', (_label, metadata) => {
    expect(() => describeGithubAppMetadata(metadata)).toThrow(InvalidMetadataError);
  });

  it.each([
    [{ issues: 'read', metadata: 'read' }, true],
    [{ issues: 'write', metadata: 'read' }, true],
    [{ issues: null, metadata: 'read' }, false],
    [{ issues: 'read', metadata: 'none' }, false],
  ])('checks the required permissions %p', (permissions, expected) => {
    expect(hasRequiredPermissions(permissions)).toBe(expected);
  });

  it.each([
    ['octocat', true],
    ['a'.repeat(39), true],
    ['a'.repeat(40), false],
    ['bad_login', false],
    [42, false],
  ])('checks the login %p', (login, expected) => {
    expect(isGithubLogin(login)).toBe(expected);
  });
});
