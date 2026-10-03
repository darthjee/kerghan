import { generateKeyPairSync, KeyObject } from 'node:crypto';

/**
 * A test-only RSA key pair, generated once per spec file, plus its private
 * half as the one-line base64 PEM the env var expects.
 */
export interface GithubAppTestKey {
  privateKey: KeyObject;
  publicKey: KeyObject;
  base64Pem: string;
}

let cached: GithubAppTestKey | undefined;

/**
 * Returns the (lazily generated, cached) test RSA key.
 * @returns {GithubAppTestKey} The test key.
 */
export function githubAppTestKey(): GithubAppTestKey {
  if (cached === undefined) {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();

    cached = { privateKey, publicKey, base64Pem: Buffer.from(pem).toString('base64') };
  }

  return cached;
}
