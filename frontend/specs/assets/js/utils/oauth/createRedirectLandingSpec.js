import createRedirectLanding from '../../../../../assets/js/utils/oauth/createRedirectLanding.js';

describe('createRedirectLanding', () => {
  let history;
  let classify;
  let landing;

  beforeEach(() => {
    history = jasmine.createSpyObj('history', ['replaceState']);
    classify = jasmine.createSpy('classify').and.returnValue({ kind: 'x' });
    landing = createRedirectLanding('/landing', classify);
  });

  it('exposes its path', () => {
    expect(landing.path).toBe('/landing');
  });

  it('cleans the URL before classifying', () => {
    classify.and.callFake(() => {
      expect(history.replaceState).toHaveBeenCalledOnceWith(null, '', '/#/account/integrations');
      return { kind: 'x' };
    });

    expect(landing.capture({ pathname: '/landing', search: '?a=1' }, history)).toBeTrue();
    expect(classify.calls.mostRecent().args[0].get('a')).toBe('1');
    expect(landing.take()).toEqual({ kind: 'x' });
  });

  it('keeps separate results per landing', () => {
    const other = createRedirectLanding('/other', classify);

    landing.capture({ pathname: '/landing', search: '' }, history);

    expect(other.take()).toBeNull();
    expect(landing.take()).toEqual({ kind: 'x' });
    expect(landing.take()).toBeNull();
  });
});
