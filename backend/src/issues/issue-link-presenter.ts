import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

/** The link object of an issue (`docs/agents/specs/issues/api/github-link.md#link-object`); opaque until #557. */
export type IssueLinkResponse = Record<string, unknown>;

/**
 * The seam that builds the `link` member of the issue responses. This implementation returns an
 * empty map, so `link` is always `null`; #557 (the GitHub link) fills it in with the link object,
 * loaded once per page: links and marker existence by issue ids, the repository status once per
 * project, and the waiting sets from memory. The listing calls it once per page and show, create
 * and edit once per issue, so #557 never changes a call site.
 */
@Injectable()
export class IssueLinkPresenter {
  /**
   * @param {number[]} _issueIds - The internal ids of the issues being presented.
   * @param {EntityManager} [_manager] - The transaction manager to read through.
   * @returns {Promise<Map<number, IssueLinkResponse>>} The link objects by issue id; an issue
   *   without an entry has no link.
   */
  forIssues(_issueIds: number[], _manager?: EntityManager): Promise<Map<number, IssueLinkResponse>> {
    return Promise.resolve(new Map());
  }
}
