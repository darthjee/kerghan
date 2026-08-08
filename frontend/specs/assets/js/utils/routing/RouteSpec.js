import Route from '../../../../../assets/js/utils/routing/Route.js';

describe('Route', () => {
  it('matches static routes', () => {
    const route = new Route('/register', 'register');

    expect(route.matches('/register')).toBe(true);
  });

  it('matches parameterized routes', () => {
    const route = new Route('/games/:id', 'game');

    expect(route.matches('/games/10')).toBe(true);
  });

  it('does not match unrelated paths', () => {
    const route = new Route('/register', 'register');

    expect(route.matches('/other')).toBe(false);
  });

  it('extracts named params from a matching path', () => {
    const route = new Route('/games/:id', 'game');

    expect(route.params('/games/10')).toEqual({ id: '10' });
  });

  it('returns an empty object when the path does not match', () => {
    const route = new Route('/games/:id', 'game');

    expect(route.params('/other')).toEqual({});
  });

  it('exposes the page identifier', () => {
    const route = new Route('/register', 'register');

    expect(route.page).toBe('register');
  });
});
