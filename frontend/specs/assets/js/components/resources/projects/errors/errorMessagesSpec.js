import ApiError from '../../../../../../../assets/js/client/ApiError.js';
import ProjectErrorMessages from '../../../../../../../assets/js/components/resources/projects/errors/errorMessages.js';
import { PROJECT_ID } from '../../../../../../support/issuesBuilders.js';

describe('ProjectErrorMessages', () => {
  const error = (status, code, message, meta, details) => new ApiError(status, message, code, details, undefined, undefined, meta);

  describe('.describe', () => {
    it('defaults to the API message', () => {
      expect(ProjectErrorMessages.describe(error(409, 'PROJECT_NAME_TAKEN', 'A project with this name already exists')))
        .toEqual({ message: 'A project with this name already exists' });
    });

    it('falls back to a generic message without one', () => {
      expect(ProjectErrorMessages.describe(undefined)).toEqual({ message: 'Request failed' });
      expect(ProjectErrorMessages.describe({ message: '' })).toEqual({ message: 'Request failed' });
    });

    describe('PROJECT_REPOSITORY_TAKEN', () => {
      it('links to the existing project', () => {
        const described = ProjectErrorMessages.describe(
          error(409, 'PROJECT_REPOSITORY_TAKEN', 'This repository already has a project', { projectId: PROJECT_ID }),
        );

        expect(described.message).toBe('This repository already has a project');
        expect(described.link).toEqual({ href: `#/projects/${PROJECT_ID}`, text: 'Open the existing project' });
      });

      ['../admin', '..%2Fadmin', undefined, 12].forEach((projectId) => {
        it(`shows no link for a non-uuid meta.projectId (${projectId})`, () => {
          const described = ProjectErrorMessages.describe(
            error(409, 'PROJECT_REPOSITORY_TAKEN', 'Taken', { projectId }),
          );

          expect(described).toEqual({ message: 'Taken' });
        });
      });

      it('shows no link without meta', () => {
        expect(ProjectErrorMessages.describe(error(409, 'PROJECT_REPOSITORY_TAKEN', 'Taken')).link).toBeUndefined();
      });
    });

    describe('PROJECT_HAS_LINKS', () => {
      it('builds the sentence from meta.linkCount', () => {
        expect(ProjectErrorMessages.describe(error(409, 'PROJECT_HAS_LINKS', 'api', { linkCount: 3 })).message)
          .toBe('3 linked issues use this repository; unlink them before changing it');
      });

      [undefined, { linkCount: 'x' }, { linkCount: -1 }, { linkCount: 1.5 }].forEach((meta) => {
        it(`falls back to the API message for ${JSON.stringify(meta)}`, () => {
          expect(ProjectErrorMessages.describe(error(409, 'PROJECT_HAS_LINKS', 'api', meta)).message).toBe('api');
        });
      });
    });

    it('words PROJECT_REPOSITORY_CHANGED', () => {
      expect(ProjectErrorMessages.describe(error(409, 'PROJECT_REPOSITORY_CHANGED', 'api')).message)
        .toBe('The project\'s repository changed; try again.');
    });

    it('words GITHUB_UNAVAILABLE', () => {
      expect(ProjectErrorMessages.describe(error(502, 'GITHUB_UNAVAILABLE', 'api')).message)
        .toBe('GitHub is unavailable right now; try again.');
    });

    it('lists the VALIDATION_FAILED details', () => {
      const described = ProjectErrorMessages.describe(
        error(400, 'VALIDATION_FAILED', 'bad', undefined, ['name must not be empty']),
      );

      expect(described).toEqual({ message: 'bad', details: ['name must not be empty'] });
    });

    it('lists no details when VALIDATION_FAILED carries none', () => {
      expect(ProjectErrorMessages.describe(error(400, 'VALIDATION_FAILED', 'bad')).details).toEqual([]);
    });
  });

  describe('.isProjectNotFound', () => {
    it('is true for a project 404', () => {
      expect(ProjectErrorMessages.isProjectNotFound(error(404, 'NOT_FOUND', 'Project not found'))).toBe(true);
    });

    it('is false for the repository 404 and for other statuses', () => {
      expect(ProjectErrorMessages.isProjectNotFound(error(404, 'NOT_FOUND', 'Repository not found'))).toBe(false);
      expect(ProjectErrorMessages.isProjectNotFound(error(409, 'PROJECT_HAS_LINKS', 'x'))).toBe(false);
      expect(ProjectErrorMessages.isProjectNotFound(undefined)).toBe(false);
    });
  });

  describe('.fieldOf', () => {
    it('targets the Name field for PROJECT_NAME_TAKEN', () => {
      expect(ProjectErrorMessages.fieldOf(error(409, 'PROJECT_NAME_TAKEN', 'x'))).toBe('name');
    });

    ['PROJECT_REPOSITORY_NOT_ADDED', 'PROJECT_REPOSITORY_TAKEN'].forEach((code) => {
      it(`targets the Repository field for ${code}`, () => {
        expect(ProjectErrorMessages.fieldOf(error(409, code, 'x'))).toBe('repository');
      });
    });

    it('targets the Repository field for the repository 404', () => {
      expect(ProjectErrorMessages.fieldOf(error(404, 'NOT_FOUND', 'Repository not found'))).toBe('repository');
    });

    it('keeps the project 404 off the Repository field', () => {
      expect(ProjectErrorMessages.fieldOf(error(404, 'NOT_FOUND', 'Project not found'))).toBe('form');
    });

    it('makes PROJECTS_LIMIT_REACHED and unknown errors form-level', () => {
      expect(ProjectErrorMessages.fieldOf(error(422, 'PROJECTS_LIMIT_REACHED', 'x'))).toBe('form');
      expect(ProjectErrorMessages.fieldOf(undefined)).toBe('form');
    });
  });

  describe('issue codes', () => {
    it('maps ISSUE_LINKED to the unlink hint', () => {
      expect(ProjectErrorMessages.describe(error(409, 'ISSUE_LINKED', 'Linked')))
        .toEqual({ message: 'Unlink this issue before deleting it' });
    });

    ['ISSUES_LIMIT_REACHED', 'ISSUE_EDIT_RATE_LIMITED'].forEach((code) => {
      it(`shows the API message of ${code} and files it form-level`, () => {
        expect(ProjectErrorMessages.describe(error(429, code, 'Limit')).message).toBe('Limit');
        expect(ProjectErrorMessages.fieldOf(error(429, code, 'Limit'))).toBe('form');
      });
    });

    ['ISSUE_EDIT_RATE_LIMITED', 'ISSUE_LINK_RATE_LIMITED', 'GITHUB_RATE_LIMITED'].forEach((code) => {
      it(`flags ${code} as a rate limit with its retryAfterSeconds`, () => {
        const limited = new ApiError(429, 'Slow down', code, undefined, 5, 7);

        expect(ProjectErrorMessages.isRateLimit(limited)).toBeTrue();
        expect(ProjectErrorMessages.describe(limited)).toEqual({ message: 'Slow down', retryAfterSeconds: 7 });
      });

      it(`leaves retryAfterSeconds undefined for ${code} without one`, () => {
        const limited = new ApiError(429, 'Slow down', code);

        expect(ProjectErrorMessages.describe(limited).retryAfterSeconds).toBeUndefined();
      });
    });

    it('does not flag other codes as a rate limit', () => {
      expect(ProjectErrorMessages.isRateLimit(error(409, 'ISSUE_LINKED', 'x'))).toBeFalse();
      expect(ProjectErrorMessages.isRateLimit(undefined)).toBeFalse();
    });
  });

  describe('.isIssueNotFound', () => {
    it('is true for a 404', () => {
      expect(ProjectErrorMessages.isIssueNotFound(error(404, undefined, 'Not found'))).toBeTrue();
    });

    it('is false for other statuses and no error', () => {
      expect(ProjectErrorMessages.isIssueNotFound(error(500, undefined, 'x'))).toBeFalse();
      expect(ProjectErrorMessages.isIssueNotFound(undefined)).toBeFalse();
    });
  });
});
