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
