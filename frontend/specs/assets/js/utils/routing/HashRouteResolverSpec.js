import HashRouteResolver from '../../../../../assets/js/utils/routing/HashRouteResolver.js';

describe('HashRouteResolver', () => {
  it('resolves the register route', () => {
    const resolver = new HashRouteResolver(() => '#/register');

    expect(resolver.getPage()).toBe('register');
  });

  it('resolves the login route', () => {
    const resolver = new HashRouteResolver(() => '#/login');

    expect(resolver.getPage()).toBe('login');
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
