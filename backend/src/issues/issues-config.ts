import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getPositiveIntConfig } from '../core/numeric-config.js';

/** Default retry cap of an `issues.reconcile` job. */
export const DEFAULT_SYNC_MAX_RETRIES = 5;
/** Default fixed cooldown between retries of a failed job (30 s). */
export const DEFAULT_SYNC_COOLDOWN_MS = 30_000;
/** Default age after which a link counts as stale (1 h). */
export const DEFAULT_SYNC_STALE_AFTER_SECONDS = 3_600;
/** Default cap of live projects per user. */
export const DEFAULT_MAX_PROJECTS_PER_USER = 100;
/** Default cap of issues per project. */
export const DEFAULT_MAX_ISSUES_PER_PROJECT = 5_000;
/** Default link creations allowed per user per window. */
export const DEFAULT_LINK_MAX_PER_WINDOW = 30;
/** Default link-creation rate-limit window (60 s). */
export const DEFAULT_LINK_WINDOW_MS = 60_000;
/** Default issue edits allowed per user per window. */
export const DEFAULT_EDIT_MAX_PER_WINDOW = 120;
/** Default issue-edit rate-limit window (60 s). */
export const DEFAULT_EDIT_WINDOW_MS = 60_000;

/**
 * The Issues values, read once from the nine `KERGHAN_ISSUES_*` env vars of
 * `docs/agents/specs/issues/sync.md#configuration`. Each is a positive integer; any other
 * value (unset, non-numeric, `0`, negative, fractional) falls back to its default.
 */
@Injectable()
export class IssuesConfig {
  readonly syncMaxRetries: number;
  readonly syncCooldownMs: number;
  readonly syncStaleAfterSeconds: number;
  readonly maxProjectsPerUser: number;
  readonly maxIssuesPerProject: number;
  readonly linkMaxPerWindow: number;
  readonly linkWindowMs: number;
  readonly editMaxPerWindow: number;
  readonly editWindowMs: number;

  /**
   * @param {ConfigService} configService - Supplies the env values.
   */
  constructor(configService: ConfigService) {
    this.syncMaxRetries = getPositiveIntConfig(configService, 'KERGHAN_ISSUES_SYNC_MAX_RETRIES', DEFAULT_SYNC_MAX_RETRIES);
    this.syncCooldownMs = getPositiveIntConfig(configService, 'KERGHAN_ISSUES_SYNC_COOLDOWN_MS', DEFAULT_SYNC_COOLDOWN_MS);
    this.syncStaleAfterSeconds = getPositiveIntConfig(
      configService,
      'KERGHAN_ISSUES_SYNC_STALE_AFTER_SECONDS',
      DEFAULT_SYNC_STALE_AFTER_SECONDS,
    );
    this.maxProjectsPerUser = getPositiveIntConfig(
      configService,
      'KERGHAN_ISSUES_MAX_PROJECTS_PER_USER',
      DEFAULT_MAX_PROJECTS_PER_USER,
    );
    this.maxIssuesPerProject = getPositiveIntConfig(
      configService,
      'KERGHAN_ISSUES_MAX_ISSUES_PER_PROJECT',
      DEFAULT_MAX_ISSUES_PER_PROJECT,
    );
    this.linkMaxPerWindow = getPositiveIntConfig(configService, 'KERGHAN_ISSUES_LINK_MAX_PER_WINDOW', DEFAULT_LINK_MAX_PER_WINDOW);
    this.linkWindowMs = getPositiveIntConfig(configService, 'KERGHAN_ISSUES_LINK_WINDOW_MS', DEFAULT_LINK_WINDOW_MS);
    this.editMaxPerWindow = getPositiveIntConfig(configService, 'KERGHAN_ISSUES_EDIT_MAX_PER_WINDOW', DEFAULT_EDIT_MAX_PER_WINDOW);
    this.editWindowMs = getPositiveIntConfig(configService, 'KERGHAN_ISSUES_EDIT_WINDOW_MS', DEFAULT_EDIT_WINDOW_MS);
  }
}
