import HashLocation from '../../../../../assets/js/utils/routing/hashLocation.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../support/fakeWindow.js';

describe('HashLocation', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('with a window', () => {
    let fakeWindow;

    beforeEach(() => {
      fakeWindow = installFakeWindow({
        location: { hash: '#/projects' },
        history: { state: { k: 1 }, replaceState: jasmine.createSpy('replaceState') },
      });
    });

    it('reads the hash', () => {
      expect(HashLocation.read()).toBe('#/projects');
    });

    it('pushes by assigning the hash', () => {
      HashLocation.push('#/projects?page=2');

      expect(fakeWindow.location.hash).toBe('#/projects?page=2');
    });

    it('replaces through history.replaceState, keeping the state', () => {
      HashLocation.replace('#/projects?page=3');

      expect(fakeWindow.history.replaceState).toHaveBeenCalledOnceWith({ k: 1 }, '', '#/projects?page=3');
    });
  });

  describe('without a window', () => {
    it('reads an empty hash and ignores writes', () => {
      expect(HashLocation.read()).toBe('');
      expect(() => HashLocation.push('#/x')).not.toThrow();
      expect(() => HashLocation.replace('#/x')).not.toThrow();
    });
  });
});
