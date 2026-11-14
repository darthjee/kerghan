/**
 * The typed, normalised results of the exported `IntegrationsGithubService`
 * (see `docs/agents/modules/integrations/github-service.md#exported-service`). They are
 * part of the module's export surface: no credential, minted token, `secret_iv`
 * or GitHub body ever appears in them.
 */
import type { GithubRateLimitFields } from './github-http.js';
import type { IntegrationType } from './integration-enums.js';

/** The normalised `X-RateLimit-*` / `Retry-After` headers of a GitHub answer. */
export type RateLimitFields = GithubRateLimitFields;

/** One repository, reduced to the fields the Repositories model stores. */
export interface GithubRepo {
  githubId: number;
  owner: string;
  name: string;
  private: boolean;
}

/** An integration, as listed by `listUsableIntegrations` / `listIntegrations`. */
export interface IntegrationRef {
  /** The internal `integrations.id` (the logical FK Repositories stores). */
  id: number;
  uuid: string;
  label: string;
  type: IntegrationType;
}

/**
 * Why an integration was not called:
 * - `status`: its reported status is not `active`;
 * - `type_disabled`: its type is not enabled on this server;
 * - `missing`: no row for that id and user (deleted, or foreign).
 */
export type IntegrationUnusableReason = 'status' | 'type_disabled' | 'missing';

/** Why a GitHub call answered nothing usable. Never reaches a response. */
export type UnavailableReason = 'timeout' | 'network_error' | 'server_error' | 'redirect' | 'forbidden' | 'unexpected';

/** The failure kinds shared by every operation. */
export type RepoFailure =
  | { kind: 'invalid_credentials' }
  | { kind: 'rate_limited'; resetAt: Date | null }
  | { kind: 'unavailable'; reason: UnavailableReason }
  | { kind: 'integration_unusable'; reason: IntegrationUnusableReason };

/**
 * One page of a listing. `not_found` is answered by the handle listing only
 * (an unknown, renamed, suspended or deleted handle).
 */
export type RepoPageResult =
  | { kind: 'ok'; repos: GithubRepo[]; etag: string | null; hasNext: boolean; rateLimit: RateLimitFields }
  | { kind: 'not_modified'; rateLimit: RateLimitFields }
  | { kind: 'not_found' }
  | RepoFailure;

/** One repository looked up by id (`GET /repositories/{id}`). */
export type RepoResult =
  | { kind: 'ok'; repo: GithubRepo }
  | { kind: 'not_found' }
  | RepoFailure;
