import DirtyFormGuardController from '../../../../../../../assets/js/components/common/forms/controllers/DirtyFormGuardController.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

describe('DirtyFormGuardController', () => {
  let fakeWindow;
  let setPendingHash;
  let controller;

  beforeEach(() => {
    fakeWindow = new EventTarget();
    fakeWindow.location = { hash: '#/projects/new' };
    fakeWindow.localStorage = jasmine.createSpyObj('localStorage', ['setItem', 'getItem']);
    fakeWindow.sessionStorage = jasmine.createSpyObj('sessionStorage', ['setItem', 'getItem']);
    installFakeWindow(fakeWindow);
    setPendingHash = jasmine.createSpy('setPendingHash');
    controller = new DirtyFormGuardController(setPendingHash);
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  /**
   * Simulate the user following an in-app link away from the form.
   *
   * @param {string} hash - The hash navigated to.
   * @returns {void}
   */
  function navigateTo(hash) {
    fakeWindow.location.hash = hash;
    fakeWindow.dispatchEvent(new Event('hashchange'));
  }

  describe('#leave', () => {
    it('navigates at once from a clean form, with no prompt (U11)', () => {
      controller.leave('#/projects', false);

      expect(fakeWindow.location.hash).toBe('#/projects');
      expect(setPendingHash).not.toHaveBeenCalled();
    });

    it('holds the target and asks from a dirty form, without navigating', () => {
      controller.leave('#/projects', true);

      expect(setPendingHash).toHaveBeenCalledOnceWith('#/projects');
      expect(fakeWindow.location.hash).toBe('#/projects/new');
    });
  });

  describe('#confirmLeave', () => {
    it('clears the pending target and navigates to it', () => {
      controller.confirmLeave('#/projects');

      expect(setPendingHash).toHaveBeenCalledOnceWith(null);
      expect(fakeWindow.location.hash).toBe('#/projects');
    });

    it('does not navigate without a pending target', () => {
      controller.confirmLeave(null);

      expect(fakeWindow.location.hash).toBe('#/projects/new');
    });
  });

  describe('#forceLeave', () => {
    it('navigates without asking, even from a dirty attached form', () => {
      controller.attach(true);

      controller.forceLeave('#/projects/abc');
      fakeWindow.dispatchEvent(new Event('hashchange'));

      expect(fakeWindow.location.hash).toBe('#/projects/abc');
      expect(setPendingHash).not.toHaveBeenCalled();
    });
  });

  describe('#cancelLeave', () => {
    it('clears the pending target and stays', () => {
      controller.cancelLeave();

      expect(setPendingHash).toHaveBeenCalledOnceWith(null);
      expect(fakeWindow.location.hash).toBe('#/projects/new');
    });
  });

  describe('#attach on a dirty form', () => {
    it('restores the previous hash on a hashchange away, then asks', () => {
      controller.attach(true);

      navigateTo('#/repositories');

      expect(fakeWindow.location.hash).toBe('#/projects/new');
      expect(setPendingHash).toHaveBeenCalledOnceWith('#/repositories');
    });

    it('ignores the hashchange fired by the restore itself', () => {
      controller.attach(true);
      navigateTo('#/repositories');
      setPendingHash.calls.reset();

      fakeWindow.dispatchEvent(new Event('hashchange'));

      expect(setPendingHash).not.toHaveBeenCalled();
    });

    it('lets the confirmed navigation through', () => {
      controller.attach(true);
      controller.confirmLeave('#/repositories');
      setPendingHash.calls.reset();

      fakeWindow.dispatchEvent(new Event('hashchange'));

      expect(fakeWindow.location.hash).toBe('#/repositories');
      expect(setPendingHash).not.toHaveBeenCalled();
    });

    it('cancels the browser unload to trigger its own prompt', () => {
      controller.attach(true);
      const event = new Event('beforeunload', { cancelable: true });

      fakeWindow.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });

    it('detaches both listeners on cleanup', () => {
      const cleanup = controller.attach(true);
      cleanup();
      const event = new Event('beforeunload', { cancelable: true });

      navigateTo('#/repositories');
      fakeWindow.dispatchEvent(event);

      expect(setPendingHash).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('#attach on a clean form', () => {
    it('leaves silently: no hash interception and no unload prompt (U11)', () => {
      const cleanup = controller.attach(false);
      const event = new Event('beforeunload', { cancelable: true });

      navigateTo('#/repositories');
      fakeWindow.dispatchEvent(event);

      expect(fakeWindow.location.hash).toBe('#/repositories');
      expect(setPendingHash).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
      expect(() => cleanup()).not.toThrow();
    });
  });

  describe('without a window', () => {
    it('attaches and navigates as no-ops', () => {
      uninstallFakeWindow();

      expect(() => controller.attach(true)()).not.toThrow();
      expect(() => controller.leave('#/projects', false)).not.toThrow();
    });
  });

  describe('S4: no draft storage', () => {
    it('never touches localStorage or sessionStorage', () => {
      controller.attach(true);
      navigateTo('#/repositories');
      controller.confirmLeave('#/repositories');
      controller.cancelLeave();
      controller.leave('#/projects', true);

      ['localStorage', 'sessionStorage'].forEach((name) => {
        expect(fakeWindow[name].setItem).not.toHaveBeenCalled();
        expect(fakeWindow[name].getItem).not.toHaveBeenCalled();
      });
    });
  });
});
