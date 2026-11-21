import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { IssueGithubLink } from '../entities/issue-github-link.entity.js';
import { IssuePendingWrite } from '../entities/issue-pending-write.entity.js';
import { Issue } from '../entities/issue.entity.js';
import { IssuesProject } from '../entities/issues-project.entity.js';

// The column allowlist of `docs/agents/specs/issues/model.md`: a column added to an entity must
// be added here (and to model.md) in the same PR. The marker has no payload column.
const ALLOWLIST: Array<[string, new () => object, string[]]> = [
  ['issues_projects', IssuesProject, [
    'id', 'uuid', 'user_id', 'name', 'description', 'repository_id', 'deleted_at', 'deleted_token', 'created_at', 'updated_at',
  ]],
  ['issues', Issue, ['id', 'uuid', 'project_id', 'title', 'body', 'state', 'created_at', 'updated_at']],
  ['issues_github_links', IssueGithubLink, [
    'id', 'user_id', 'issue_id', 'github_issue_id', 'github_number', 'status', 'status_reason', 'base_title', 'base_body',
    'base_state', 'github_updated_at', 'last_synced_at', 'etag', 'created_at', 'updated_at',
  ]],
  ['issues_pending_writes', IssuePendingWrite, ['id', 'link_id', 'revision', 'marked_at', 'updated_at']],
];

/**
 * @param target - An entity class.
 * @returns Its mapped column names, sorted.
 */
function columnsOf(target: object): string[] {
  return getMetadataArgsStorage().columns
    .filter((column) => column.target === target)
    .map((column) => column.options.name ?? column.propertyName)
    .sort();
}

describe('Issues entity columns (static)', () => {
  it.each(ALLOWLIST)('%s has exactly the allowlisted columns', (_table, entity, columns) => {
    expect(columnsOf(entity)).toEqual([...columns].sort());
  });

  it('gives the marker no payload column', () => {
    expect(columnsOf(IssuePendingWrite)).toEqual(['id', 'link_id', 'marked_at', 'revision', 'updated_at']);
  });
});
