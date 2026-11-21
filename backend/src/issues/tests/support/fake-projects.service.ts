import type { ProjectDeleteResponse, ProjectListingResponse, ProjectResponse } from '../../project-response.js';
import type { ProjectsService } from '../../projects.service.js';
import type {
  CreationMode,
  CreationResult,
  EditProjectInput,
  ListProjectsInput,
  ProjectCreationInput,
  ProjectRepositoryInput,
} from '../../types/projects-api.types.js';

/** The `ProjectsService` methods the controller uses. */
export type ProjectsServiceSurface = Pick<ProjectsService, 'create' | 'list' | 'show' | 'edit' | 'setRepository' | 'delete'>;

/** One logged call. */
export interface FakeProjectsCall {
  method: keyof ProjectsServiceSurface;
  userId: number;
  args: unknown[];
}

/** A project object with every field set, for responses. */
export function sampleProject(overrides: Partial<ProjectResponse> = {}): ProjectResponse {
  return {
    id: '3f2a0000-0000-4000-8000-0000000000c9',
    name: 'Kerghan',
    description: null,
    repository: null,
    openIssueCount: 0,
    createdAt: '2026-11-17T12:00:00.000Z',
    updatedAt: '2026-11-17T12:00:00.000Z',
    ...overrides,
  };
}

/**
 * A recording stand-in for `ProjectsService` in the HTTP-layer specs (the real one runs MySQL):
 * every method answers a canned result, or throws the error set with `failWith`, and logs its
 * call (`calls`), so a spec sees exactly what the controller validated and passed on. It has no
 * GitHub or queue dependency to call, by construction.
 */
export class FakeProjectsService implements ProjectsServiceSurface {
  readonly calls: FakeProjectsCall[] = [];
  creation: CreationResult = { status: 201, project: sampleProject() };
  project: ProjectResponse = sampleProject();
  listing: ProjectListingResponse = { projects: [], pagination: { page: 1, perPage: 50, total: 0, totalPages: 0 } };
  deletion: ProjectDeleteResponse = { unsentIssueCount: 0 };
  #failure: { method: keyof ProjectsServiceSurface; error: Error } | null = null;

  /** Makes the next call of `method` throw `error`. */
  failWith(method: keyof ProjectsServiceSurface, error: Error): this {
    this.#failure = { method, error };

    return this;
  }

  callsOf(method: keyof ProjectsServiceSurface): FakeProjectsCall[] {
    return this.calls.filter((call) => call.method === method);
  }

  async create(userId: number, input: ProjectCreationInput, mode: CreationMode): Promise<CreationResult> {
    this.#record('create', userId, input, mode);

    return this.creation;
  }

  async list(userId: number, input: ListProjectsInput): Promise<ProjectListingResponse> {
    this.#record('list', userId, input);

    return this.listing;
  }

  async show(userId: number, projectUuid: string): Promise<ProjectResponse> {
    this.#record('show', userId, projectUuid);

    return this.project;
  }

  async edit(userId: number, projectUuid: string, input: EditProjectInput): Promise<ProjectResponse> {
    this.#record('edit', userId, projectUuid, input);

    return this.project;
  }

  async setRepository(userId: number, projectUuid: string, input: ProjectRepositoryInput): Promise<ProjectResponse> {
    this.#record('setRepository', userId, projectUuid, input);

    return this.project;
  }

  async delete(userId: number, projectUuid: string): Promise<ProjectDeleteResponse> {
    this.#record('delete', userId, projectUuid);

    return this.deletion;
  }

  #record(method: keyof ProjectsServiceSurface, userId: number, ...args: unknown[]): void {
    this.calls.push({ method, userId, args });

    if (this.#failure?.method === method) {
      const { error } = this.#failure;

      this.#failure = null;
      throw error;
    }
  }
}
