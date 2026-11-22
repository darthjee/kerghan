import ProjectPaths from '../../../../../../assets/js/components/resources/projects/paths.js';

describe('ProjectPaths', () => {
  it('names the list', () => {
    expect(ProjectPaths.list).toBe('#/projects');
  });

  it('builds the project page and management hashes, encoding the id (S3)', () => {
    expect(ProjectPaths.show('abc')).toBe('#/projects/abc');
    expect(ProjectPaths.edit('abc')).toBe('#/projects/abc/edit');
    expect(ProjectPaths.show('..%2Fadmin')).toBe('#/projects/..%252Fadmin');
    expect(ProjectPaths.show('a/b')).toBe('#/projects/a%2Fb');
    expect(ProjectPaths.edit('../x')).toBe('#/projects/..%2Fx/edit');
  });

  describe('issue hashes', () => {
    it('builds the issue page, new and edit hashes', () => {
      expect(ProjectPaths.issue('p', 'i')).toBe('#/projects/p/issues/i');
      expect(ProjectPaths.newIssue('p')).toBe('#/projects/p/issues/new');
      expect(ProjectPaths.editIssue('p', 'i')).toBe('#/projects/p/issues/i/edit');
    });

    it('encodes every id (S3)', () => {
      expect(ProjectPaths.issue('a/b', '../x')).toBe('#/projects/a%2Fb/issues/..%2Fx');
      expect(ProjectPaths.newIssue('a/b')).toBe('#/projects/a%2Fb/issues/new');
      expect(ProjectPaths.editIssue('a?b', 'c#d')).toBe('#/projects/a%3Fb/issues/c%23d/edit');
    });

    it('builds the issue list hash, leaving defaults out', () => {
      expect(ProjectPaths.issues('p')).toBe('#/projects/p');
      expect(ProjectPaths.issues('p', { page: 1, search: '', state: 'open' })).toBe('#/projects/p');
      expect(ProjectPaths.issues('p', { page: 2, search: 'a b', state: 'closed' }))
        .toBe('#/projects/p?state=closed&search=a+b&page=2');
      expect(ProjectPaths.issues('a/b', { page: 1, search: '', state: 'all' })).toBe('#/projects/a%2Fb?state=all');
    });
  });

  describe('.newProject', () => {
    it('is the plain form without a prefill', () => {
      expect(ProjectPaths.newProject()).toBe('#/projects/new');
    });

    it('carries the repository and name in the query, encoded', () => {
      expect(ProjectPaths.newProject({
        githubId: 7, fullName: 'a b/c&d', name: 'a b/c&d', nameTaken: false,
      })).toBe('#/projects/new?repository=7&repositoryName=a+b%2Fc%26d&name=a+b%2Fc%26d');
    });

    it('adds the name-taken flag', () => {
      expect(ProjectPaths.newProject({
        githubId: 7, fullName: 'a/b', name: 'a/b', nameTaken: true,
      })).toContain('&error=name_taken');
    });
  });
});
