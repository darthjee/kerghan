import { NotFoundException } from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';
import { Issue } from '../entities/issue.entity.js';
import { IssuesProject } from '../entities/issues-project.entity.js';
import { IssuesAccess } from '../issues-access.js';

function repositoryReturning(row: unknown): { findOne: jest.Mock } {
  return { findOne: jest.fn().mockResolvedValue(row) };
}

function build(projectRow: unknown, issueRow: unknown = null): {
  access: IssuesAccess;
  projects: { findOne: jest.Mock };
  issues: { findOne: jest.Mock };
} {
  const projects = repositoryReturning(projectRow);
  const issues = repositoryReturning(issueRow);
  const access = new IssuesAccess(projects as unknown as Repository<IssuesProject>, issues as unknown as Repository<Issue>);

  return { access, projects, issues };
}

describe('IssuesAccess', () => {
  it('finds the live project by uuid, user and deleted_token 0', async () => {
    const project = { id: 3 } as IssuesProject;
    const { access, projects } = build(project);

    await expect(access.findLiveProject(7, 'uuid-1')).resolves.toBe(project);
    expect(projects.findOne).toHaveBeenCalledWith({ where: { uuid: 'uuid-1', userId: 7, deletedToken: 0 } });
  });

  it('locks the project row FOR UPDATE when asked, through the given manager', async () => {
    const { access, projects } = build(null);
    const locked = { findOne: jest.fn().mockResolvedValue({ id: 3 }) };
    const manager = { getRepository: jest.fn().mockReturnValue(locked) } as unknown as EntityManager;

    await access.findLiveProject(7, 'uuid-1', manager, { lock: true });

    expect(projects.findOne).not.toHaveBeenCalled();
    expect(locked.findOne).toHaveBeenCalledWith({
      where: { uuid: 'uuid-1', userId: 7, deletedToken: 0 },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it('answers one byte-identical 404 for any project that is not found', async () => {
    const { access } = build(null);
    const first = await access.findLiveProject(7, 'a').catch((error: unknown) => error);
    const second = await access.findLiveProject(8, 'b').catch((error: unknown) => error);

    expect(first).toBeInstanceOf(NotFoundException);
    expect((first as NotFoundException).getResponse()).toEqual((second as NotFoundException).getResponse());
    expect((first as NotFoundException).message).toBe('Project not found');
  });

  it('looks the issue up only inside the resolved project', async () => {
    const issue = { id: 9 } as Issue;
    const { access, issues } = build(null, issue);

    await expect(access.findIssueInProject({ id: 3 } as IssuesProject, 'issue-uuid')).resolves.toBe(issue);
    expect(issues.findOne).toHaveBeenCalledWith({ where: { uuid: 'issue-uuid', projectId: 3 } });
  });

  it('locks the issue row when asked', async () => {
    const { access, issues } = build(null, { id: 9 });

    await access.findIssueInProject({ id: 3 } as IssuesProject, 'issue-uuid', undefined, { lock: true });

    expect(issues.findOne).toHaveBeenCalledWith({
      where: { uuid: 'issue-uuid', projectId: 3 },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it('answers 404 Issue not found for a missing issue', async () => {
    const { access } = build(null, null);
    const error = await access.findIssueInProject({ id: 3 } as IssuesProject, 'x').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).message).toBe('Issue not found');
  });
});
