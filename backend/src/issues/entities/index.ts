import { IssueGithubLink } from './issue-github-link.entity.js';
import { IssuePendingWrite } from './issue-pending-write.entity.js';
import { Issue } from './issue.entity.js';
import { IssuesProject } from './issues-project.entity.js';

/** Every entity of the Issues module, for `TypeOrmModule.forFeature` and the DB tier. */
export const ISSUES_ENTITIES = [IssuesProject, Issue, IssueGithubLink, IssuePendingWrite];
