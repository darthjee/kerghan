import HashRouteResolver from '../../../../../assets/js/utils/routing/HashRouteResolver.js';

describe('HashRouteResolver', () => {
  it('no longer resolves the removed register route, falling back to home', () => {
    const resolver = new HashRouteResolver(() => '#/register');

    expect(resolver.getPage()).toBe('home');
  });

  it('no longer resolves the removed login route, falling back to home', () => {
    const resolver = new HashRouteResolver(() => '#/login');

    expect(resolver.getPage()).toBe('home');
  });

  it('no longer resolves the removed recover route, falling back to home', () => {
    const resolver = new HashRouteResolver(() => '#/recover');

    expect(resolver.getPage()).toBe('home');
  });

  it('resolves the reset-password route', () => {
    const resolver = new HashRouteResolver(() => '#/recover-password');

    expect(resolver.getPage()).toBe('reset-password');
  });

  it('resolves the reset-password route with a token query string', () => {
    const resolver = new HashRouteResolver(() => '#/recover-password?token=abc123');

    expect(resolver.getPage()).toBe('reset-password');
  });

  it('resolves the admin-users route', () => {
    const resolver = new HashRouteResolver(() => '#/admin/users');

    expect(resolver.getPage()).toBe('admin-users');
  });

  it('resolves the admin-user-edit route', () => {
    const resolver = new HashRouteResolver(() => '#/admin/users/42/edit');

    expect(resolver.getPage()).toBe('admin-user-edit');
  });

  it('resolves the authorization-requests route', () => {
    const resolver = new HashRouteResolver(() => '#/account/authorization-requests');

    expect(resolver.getPage()).toBe('authorization-requests');
  });

  it('resolves the integrations route', () => {
    const resolver = new HashRouteResolver(() => '#/account/integrations');

    expect(resolver.getPage()).toBe('integrations');
  });

  it('resolves the repositories route', () => {
    const resolver = new HashRouteResolver(() => '#/repositories');

    expect(resolver.getPage()).toBe('repositories');
  });

  it('resolves the sessions route', () => {
    const resolver = new HashRouteResolver(() => '#/account/sessions');

    expect(resolver.getPage()).toBe('sessions');
  });

  describe('Issues and Projects routes', () => {
    const ID = '11111111-1111-4111-8111-111111111111';
    const ISSUE = '22222222-2222-4222-8222-222222222222';
    const pageAt = (hash) => new HashRouteResolver(() => hash).getPage();

    it('resolves the seven routes to their page keys', () => {
      expect(pageAt('#/projects')).toBe('projects');
      expect(pageAt('#/projects/new')).toBe('project-new');
      expect(pageAt(`#/projects/${ID}`)).toBe('project');
      expect(pageAt(`#/projects/${ID}/edit`)).toBe('project-edit');
      expect(pageAt(`#/projects/${ID}/issues/new`)).toBe('issue-new');
      expect(pageAt(`#/projects/${ID}/issues/${ISSUE}`)).toBe('issue');
      expect(pageAt(`#/projects/${ID}/issues/${ISSUE}/edit`)).toBe('issue-edit');
    });

    it('resolves /projects/new to project-new, not project', () => {
      expect(pageAt('#/projects/new')).not.toBe('project');
    });

    it('resolves …/issues/new to issue-new, not issue', () => {
      expect(pageAt(`#/projects/${ID}/issues/new`)).not.toBe('issue');
    });

    it('strips the query string before matching', () => {
      expect(pageAt('#/projects?search=foo&page=2')).toBe('projects');
      expect(pageAt(`#/projects/${ID}?state=closed&search=x`)).toBe('project');
      expect(pageAt('#/projects/new?repository=5&repositoryName=a%2Fb&name=a%2Fb')).toBe('project-new');
    });

    it('accepts a trailing slash', () => {
      expect(pageAt('#/projects/')).toBe('projects');
    });

    it('keeps resolving the existing routes', () => {
      expect(pageAt('#/repositories')).toBe('repositories');
      expect(pageAt('#/')).toBe('home');
    });
  });

  it('resolves the home route', () => {
    const resolver = new HashRouteResolver(() => '#/');

    expect(resolver.getPage()).toBe('home');
  });

  it('resolves an empty hash to home', () => {
    const resolver = new HashRouteResolver(() => '');

    expect(resolver.getPage()).toBe('home');
  });

  it('resolves an unknown route to home', () => {
    const resolver = new HashRouteResolver(() => '#/unknown');

    expect(resolver.getPage()).toBe('home');
  });

  it('exposes the current hash', () => {
    const resolver = new HashRouteResolver(() => '#/register');

    expect(resolver.currentHash()).toBe('#/register');
  });

  it('defaults to reading window.location.hash', () => {
    const resolver = new HashRouteResolver();

    expect(resolver.currentHash()).toBe('');
  });
});
