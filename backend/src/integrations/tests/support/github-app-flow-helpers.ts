import { inspect } from 'node:util';
import { HttpException } from '@nestjs/common';
import { githubAppExchangeResponse } from './fake-github-answers.js';
import type { GithubAppHarness } from './github-app-harness.js';
import { CANARY_FRAGMENT } from './integrations-harness.js';
import type { GithubUserInstallation } from '../../github-app-client.service.js';

/** The caller of most specs. */
export const OWNER = 1;
/** Another Kerghan user. */
export const INTRUDER = 2;
/** A recognisable callback code that must never leak anywhere. */
export const CANARY_CODE = 'CANARYcanaryCODE0123';
/** A well-formed uuid no row has. */
export const MISSING_UUID = '0b6c1f8e-3a52-4c1b-9d5a-6f2e7c8d9a10';

/**
 * Captures what a call throws.
 * @param {Promise<unknown>} promise - The call.
 * @returns {Promise<HttpException>} The thrown exception.
 */
export async function rejection(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    return error as HttpException;
  }

  throw new Error('expected the call to throw');
}

/**
 * Asserts an HTTP exception's status and code, and that it holds no canary.
 * @param {HttpException} error - The exception.
 * @param {number} status - The expected status.
 * @param {string} [code] - The expected code.
 */
export function expectHttp(error: HttpException, status: number, code?: string): void {
  expect(error).toBeInstanceOf(HttpException);
  expect(error.getStatus()).toBe(status);

  if (code !== undefined) {
    expect(error.getResponse()).toMatchObject({ code });
  }

  expect(inspect(error, { depth: 10 })).not.toContain(CANARY_FRAGMENT);
}

/**
 * Starts a flow and extracts the `state` from the redirect URL.
 * @param {GithubAppHarness} h - The harness.
 * @param {object} body - The start body.
 * @param {string} [body.label] - The label (create).
 * @param {string} [body.integrationId] - The target (replace).
 * @param {string} [body.mode] - `install` or `connect`.
 * @param {number} [userId] - The caller.
 * @returns {Promise<string>} The `state` value.
 */
export async function startState(
  h: GithubAppHarness,
  body: { label?: string; integrationId?: string; mode?: 'install' | 'connect' },
  userId = OWNER,
): Promise<string> {
  const { redirectUrl } = await h.flow.start(userId, body);

  return new URL(redirectUrl).searchParams.get('state') as string;
}

/**
 * Creates a `github_app` integration through the whole install flow, then resets the fake.
 * @param {GithubAppHarness} h - The harness.
 * @param {string} [label] - The label.
 * @returns {Promise<string>} The new integration's uuid.
 */
export async function connect(h: GithubAppHarness, label = 'Work'): Promise<string> {
  const state = await startState(h, { label });
  const result = await h.flow.callback(OWNER, { code: CANARY_CODE, state, installationId: 12345678, setupAction: 'install' });

  resetGithub(h);

  if (result.kind !== 'stored') {
    throw new Error('expected a stored integration');
  }

  return result.integration.id;
}

/**
 * An installation entry of `GET /user/installations`.
 * @param {number} installationId - The id.
 * @param {string} accountLogin - The account login.
 * @param {number} [appId] - The app id.
 * @returns {GithubUserInstallation} The entry.
 */
export function entry(installationId: number, accountLogin: string, appId = 123456): GithubUserInstallation {
  return { installationId, appId, accountLogin, accountType: accountLogin === 'octocat' ? 'User' : 'Organization' };
}

/**
 * Clears the fake GitHub client, keeping the GitHub App's `ghu_` exchange default.
 * @param {GithubAppHarness} h - The harness.
 */
export function resetGithub(h: GithubAppHarness): void {
  h.github.reset();
  h.github.exchangeRespondByDefault(githubAppExchangeResponse());
}
