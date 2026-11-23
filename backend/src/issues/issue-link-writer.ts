import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { duplicateEntryIndex, LINK_ISSUE_INDEX, LINK_USER_GITHUB_ISSUE_INDEX } from './duplicate-entry.js';
import type { Issue } from './entities/issue.entity.js';
import type { IssuesProject } from './entities/issues-project.entity.js';
import { differencesOf, githubValues, type IssueValues } from './github-values.js';
import { IssueLinkStore } from './issue-link-store.js';
import { IssueStore } from './issue-store.js';
import { IssuesAccess } from './issues-access.js';
import { IssuesConfig } from './issues-config.js';
import {
  githubIssueAlreadyLinked,
  issueAlreadyLinked,
  issueAttachConfirmationRequired,
  issuesLimitReached,
  projectRepositoryChanged,
} from './issues-http-errors.js';
import { stampOf } from './timestamps.js';
import { Clock } from '../core/clock.js';
import type { GithubIssue } from '../integrations/integrations-github.public.js';


/** What import and attach share: the project, the GitHub answer and the repository read before the transaction. */
export interface LinkCreation {
  userId: number;
  projectUuid: string;
  /** The project's `repository_id` as read before the GitHub call (E62). */
  repositoryId: number;
  github: { issue: GithubIssue; etag: string | null };
}

/** Import creates a new issue; attach links one that exists and, when values differ, needs a confirmation. */
export type LinkTarget = { kind: 'import' } | { kind: 'attach'; issueUuid: string; confirmUpdatedAt?: Date };

/**
 * The write half of link creation (`docs/agents/backend/routes/issues/github-link.md`): one
 * transaction in the lock order projects, issues, links, markers that re-checks what was read
 * before the GitHub call, then writes the issue (import, or an attach that needs it) and the link.
 * It creates no marker, writes nothing to GitHub and enqueues nothing. A unique-index race is
 * turned into the documented `409` after the rollback.
 */
@Injectable()
export class IssueLinkWriter {
  /**
   * @param {IssuesAccess} access - The project and issue lookups, with their locks.
   * @param {IssueStore} issues - The `issues` writes and the cap count.
   * @param {IssueLinkStore} links - The `issues_github_links` reads and writes.
   * @param {IssuesConfig} config - Supplies `maxIssuesPerProject`.
   * @param {DataSource} dataSource - Opens the transaction.
   * @param {Clock} clock - The time source.
   */
  constructor(
    private readonly access: IssuesAccess,
    private readonly issues: IssueStore,
    private readonly links: IssueLinkStore,
    private readonly config: IssuesConfig,
    private readonly dataSource: DataSource,
    private readonly clock: Clock,
  ) {}

  /**
   * Creates the link, and the issue on import, in one transaction.
   * @param {LinkCreation} creation - The caller, project and the GitHub answer.
   * @param {LinkTarget} target - Import, or attach to an existing issue.
   * @returns {Promise<Issue>} The stored issue, as it reads after the write.
   * @throws {NotFoundException} `NOT_FOUND` when the project or the attach target was deleted meanwhile.
   * @throws {ConflictException} `PROJECT_REPOSITORY_CHANGED`, `ISSUES_LIMIT_REACHED`, `ISSUE_ALREADY_LINKED`,
   *   `GITHUB_ISSUE_ALREADY_LINKED` or `ISSUE_ATTACH_CONFIRMATION_REQUIRED`.
   */
  async create(creation: LinkCreation, target: LinkTarget): Promise<Issue> {
    try {
      return await this.dataSource.transaction((manager) => this.#createIn(manager, creation, target));
    } catch (error) {
      throw await this.#raceError(error, creation) ?? error;
    }
  }

  /**
   * The transaction body: project lock, the E62 re-check, the target, the E4 check and the writes.
   * @param {EntityManager} manager - The transaction manager.
   * @param {LinkCreation} creation - The caller, project and the GitHub answer.
   * @param {LinkTarget} target - Import, or attach.
   * @returns {Promise<Issue>} The stored issue.
   */
  async #createIn(manager: EntityManager, creation: LinkCreation, target: LinkTarget): Promise<Issue> {
    const project = await this.access.findLiveProject(creation.userId, creation.projectUuid, manager, { lock: true });

    if (project.repositoryId !== creation.repositoryId) throw projectRepositoryChanged();

    const values = githubValues(creation.github.issue);

    if (target.kind === 'import') await this.#assertRoom(manager, project);

    const existing = target.kind === 'attach' ? await this.#attachTarget(manager, project, target, values) : null;

    await this.#assertNotLinkedElsewhere(manager, creation);

    return this.#write(manager, creation, project, existing, values);
  }

  /**
   * Import's guard: the cap, checked again under the project lock.
   * @param {EntityManager} manager - The transaction manager.
   * @param {IssuesProject} project - The locked project.
   * @returns {Promise<void>}
   */
  async #assertRoom(manager: EntityManager, project: IssuesProject): Promise<void> {
    if (await this.issues.countInProject(manager, project.id) >= this.config.maxIssuesPerProject) throw issuesLimitReached();
  }

  /**
   * Attach's guards: the issue (locked) still exists, has no link, and the confirmation fits.
   * @param {EntityManager} manager - The transaction manager.
   * @param {IssuesProject} project - The locked project.
   * @param {Extract<LinkTarget, { kind: 'attach' }>} target - The attach target.
   * @param {IssueValues} values - The GitHub values.
   * @returns {Promise<Issue>} The locked issue.
   */
  async #attachTarget(
    manager: EntityManager,
    project: IssuesProject,
    target: Extract<LinkTarget, { kind: 'attach' }>,
    values: IssueValues,
  ): Promise<Issue> {
    const issue = await this.access.findIssueInProject(project, target.issueUuid, manager, { lock: true });

    if (await this.links.findByIssue(manager, issue.id, { lock: false }) !== null) throw issueAlreadyLinked();

    return this.#confirmed(issue, target, values);
  }

  /**
   * The attach confirmation: when the values differ, the caller must have confirmed this exact
   * `updatedAt`; equal values need no confirmation.
   * @param {Issue} issue - The locked issue.
   * @param {Extract<LinkTarget, { kind: 'attach' }>} target - The attach target.
   * @param {IssueValues} values - The GitHub values.
   * @returns {Issue} The issue.
   */
  #confirmed(issue: Issue, target: Extract<LinkTarget, { kind: 'attach' }>, values: IssueValues): Issue {
    const differences = differencesOf(issue, values);

    if (differences.length > 0 && target.confirmUpdatedAt?.getTime() !== issue.updatedAt.getTime()) {
      throw issueAttachConfirmationRequired(differences, issue.updatedAt.toISOString());
    }

    return issue;
  }

  /**
   * E4: this user may link a GitHub issue once.
   * @param {EntityManager} manager - The transaction manager.
   * @param {LinkCreation} creation - The caller and the GitHub answer.
   * @returns {Promise<void>}
   */
  async #assertNotLinkedElsewhere(manager: EntityManager, creation: LinkCreation): Promise<void> {
    const existing = await this.links.findByGithubIssue(manager, creation.userId, creation.github.issue.id);

    if (existing !== null) throw githubIssueAlreadyLinked(existing.projectUuid, existing.issueUuid);
  }

  /**
   * The writes: the issue (new, replaced or untouched), then the link with its base snapshot.
   * @param {EntityManager} manager - The transaction manager.
   * @param {LinkCreation} creation - The caller and the GitHub answer.
   * @param {IssuesProject} project - The locked project.
   * @param {Issue | null} existing - The attach target, or `null` on import.
   * @param {IssueValues} values - The GitHub values.
   * @returns {Promise<Issue>} The stored issue.
   */
  async #write(
    manager: EntityManager,
    creation: LinkCreation,
    project: IssuesProject,
    existing: Issue | null,
    values: IssueValues,
  ): Promise<Issue> {
    const issue = existing === null
      ? await this.#insertIssue(manager, project, values)
      : await this.#replaceValues(manager, existing, values);
    const github = creation.github.issue;

    await this.links.insert(manager, {
      userId: creation.userId,
      issueId: issue.id,
      githubIssueId: github.id,
      githubNumber: github.number,
      baseTitle: values.title,
      baseBody: values.body,
      baseState: values.state,
      githubUpdatedAt: new Date(Math.floor(github.updatedAt.getTime() / 1000) * 1000),
      etag: creation.github.etag,
      now: stampOf(this.clock),
    });

    return issue;
  }

  /**
   * Import: a new issue with the GitHub values.
   * @param {EntityManager} manager - The transaction manager.
   * @param {IssuesProject} project - The locked project.
   * @param {IssueValues} values - The GitHub values.
   * @returns {Promise<Issue>} The saved issue.
   */
  #insertIssue(manager: EntityManager, project: IssuesProject, values: IssueValues): Promise<Issue> {
    return this.issues.insert(manager, {
      uuid: randomUUID(),
      projectId: project.id,
      ...values,
      createdAt: stampOf(this.clock),
      updatedAt: this.clock.now(),
    });
  }

  /**
   * Attach: replaces the local values with GitHub's when they differ; otherwise writes nothing.
   * @param {EntityManager} manager - The transaction manager.
   * @param {Issue} issue - The locked issue.
   * @param {IssueValues} values - The GitHub values.
   * @returns {Promise<Issue>} The issue, as stored.
   */
  async #replaceValues(manager: EntityManager, issue: Issue, values: IssueValues): Promise<Issue> {
    if (differencesOf(issue, values).length === 0) return issue;

    const updatedAt = this.clock.now();

    await this.issues.update(manager, issue.id, values, updatedAt);

    return Object.assign(issue, values, { updatedAt });
  }

  /**
   * Turns a unique-index violation into its `409`, re-reading the winner of the GitHub-issue race.
   * @param {unknown} error - What the transaction threw.
   * @param {LinkCreation} creation - The caller and the GitHub answer.
   * @returns {Promise<Error | null>} The `409` to throw, or `null` when the error is something else.
   */
  async #raceError(error: unknown, creation: LinkCreation): Promise<Error | null> {
    const index = duplicateEntryIndex(error);

    if (index === LINK_ISSUE_INDEX) return issueAlreadyLinked();
    if (index !== LINK_USER_GITHUB_ISSUE_INDEX) return null;

    const winner = await this.links.findByGithubIssue(this.dataSource.manager, creation.userId, creation.github.issue.id);

    return winner === null ? null : githubIssueAlreadyLinked(winner.projectUuid, winner.issueUuid);
  }
}
