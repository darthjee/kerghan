import { Secret } from '../secret.js';
import {
  githubAppPayload,
  installationIdOf,
  maskInstallationId,
  parseGithubAppPayload,
} from '../types/github-app/github-app-credential.js';

describe('github-app credential helpers', () => {
  it('wraps and unwraps the installation id', () => {
    const payload = githubAppPayload(12345678);

    expect(payload.reveal()).toEqual({ installationId: 12345678 });
    expect(installationIdOf(payload)).toBe(12345678);
  });

  it('accepts a valid decrypted payload', () => {
    expect(parseGithubAppPayload(new Secret({ installationId: 42 }))?.reveal()).toEqual({ installationId: 42 });
  });

  it.each([
    ['an extra key', { installationId: 42, token: 'x' }],
    ['a non-integer id', { installationId: 4.2 }],
    ['a string id', { installationId: '42' }],
    ['a zero id', { installationId: 0 }],
    ['an unsafe id', { installationId: 2 ** 53 }],
    ['no id', {}],
    ['an array', [42]],
    ['null', null],
    ['a string', 'installation'],
  ])('rejects a decrypted payload with %s', (_label, raw) => {
    expect(parseGithubAppPayload(new Secret(raw))).toBeNull();
  });

  it.each([
    [12345678, 'installation …5678'],
    [987, 'installation …987'],
    [10000, 'installation …0000'],
  ])('masks %i as %s', (id, hint) => {
    expect(maskInstallationId(id)).toBe(hint);
  });
});
