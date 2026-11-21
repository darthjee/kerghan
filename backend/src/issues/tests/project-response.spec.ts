import type { RepositorySummary } from '../../repositories/repositories.public.js';
import { IssuesProject } from '../entities/issues-project.entity.js';
import { deleteResponse, listingResponse, projectResponse } from '../project-response.js';

const CREATED = new Date('2026-11-17T12:00:00Z');
const UPDATED = new Date('2026-11-18T08:30:00Z');

function project(overrides: Partial<IssuesProject> = {}): IssuesProject {
  return Object.assign(new IssuesProject(), {
    id: 41,
    uuid: '3f2a0000-0000-4000-8000-0000000000c9',
    userId: 7,
    name: 'Kerghan',
    description: null,
    repositoryId: 12,
    deletedAt: null,
    deletedToken: 0,
    createdAt: CREATED,
    updatedAt: UPDATED,
    ...overrides,
  });
}

const SUMMARY: RepositorySummary = {
  githubId: 123456,
  owner: 'darthjee',
  name: 'kerghan',
  fullName: 'darthjee/kerghan',
  private: false,
  status: 'added',
};

describe('projectResponse', () => {
  it('builds the project object with the uuid as id and ISO dates', () => {
    expect(projectResponse(project({ description: 'notes' }), SUMMARY, 4)).toEqual({
      id: '3f2a0000-0000-4000-8000-0000000000c9',
      name: 'Kerghan',
      description: 'notes',
      repository: SUMMARY,
      openIssueCount: 4,
      createdAt: '2026-11-17T12:00:00.000Z',
      updatedAt: '2026-11-18T08:30:00.000Z',
    });
  });

  it('reads a null description as null', () => {
    expect(projectResponse(project(), SUMMARY, 0).description).toBeNull();
  });

  it('has a null repository for a non-code project, even when a summary is passed', () => {
    expect(projectResponse(project({ repositoryId: null }), undefined, 0).repository).toBeNull();
    expect(projectResponse(project({ repositoryId: null }), SUMMARY, 0).repository).toBeNull();
  });

  it('reads a dangling reference as unavailable with null snapshot fields', () => {
    expect(projectResponse(project(), undefined, 0).repository).toEqual({
      githubId: null,
      owner: null,
      name: null,
      fullName: null,
      private: null,
      status: 'unavailable',
    });
  });

  it('never carries an internal id, user_id, repository_id or deletion column', () => {
    const body = projectResponse(project(), SUMMARY, 1);

    expect(Object.keys(body).sort()).toEqual(['createdAt', 'description', 'id', 'name', 'openIssueCount', 'repository', 'updatedAt']);
    expect(JSON.stringify(body)).not.toMatch(/userId|user_id|repositoryId|deleted/);
    expect(Object.keys(body.repository ?? {}).sort()).toEqual(['fullName', 'githubId', 'name', 'owner', 'private', 'status']);
  });

  it('does not share the dangling object between responses', () => {
    const first = projectResponse(project(), undefined, 0).repository;
    const second = projectResponse(project(), undefined, 0).repository;

    expect(first).not.toBe(second);
  });
});

describe('listingResponse', () => {
  it('maps each row and copies the pagination', () => {
    const body = listingResponse(
      [
        { project: project(), summary: SUMMARY, openIssueCount: 2 },
        { project: project({ uuid: 'other', repositoryId: null }), summary: undefined, openIssueCount: 0 },
      ],
      { page: 2, perPage: 2, total: 4, totalPages: 2 },
    );

    expect(body.projects.map((row) => [row.id, row.openIssueCount])).toEqual([
      ['3f2a0000-0000-4000-8000-0000000000c9', 2],
      ['other', 0],
    ]);
    expect(body.pagination).toEqual({ page: 2, perPage: 2, total: 4, totalPages: 2 });
  });

  it('answers an empty page', () => {
    expect(listingResponse([], { page: 9, perPage: 50, total: 0, totalPages: 0 })).toEqual({
      projects: [],
      pagination: { page: 9, perPage: 50, total: 0, totalPages: 0 },
    });
  });
});

describe('deleteResponse', () => {
  it('answers the unsent issue count only', () => {
    expect(deleteResponse(2)).toEqual({ unsentIssueCount: 2 });
  });
});
