import { buildFocusEffect } from '../../../../../../../assets/js/components/common/awaitingApproval/hooks/useWindowFocusRecheck.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

describe('useWindowFocusRecheck', () => {
  let controller;

  beforeEach(() => {
    installFakeWindow(new EventTarget());
    controller = jasmine.createSpyObj('controller', ['checkAgain']);
    controller.checkAgain.and.resolveTo();
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('buildFocusEffect', () => {
    it('does not re-check on mount', () => {
      buildFocusEffect(controller)();

      expect(controller.checkAgain).not.toHaveBeenCalled();
    });

    it('re-checks on each window focus', () => {
      buildFocusEffect(controller)();

      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('focus'));

      expect(controller.checkAgain).toHaveBeenCalledTimes(2);
    });

    it('starts no timer', () => {
      spyOn(globalThis, 'setInterval');
      spyOn(globalThis, 'setTimeout');

      buildFocusEffect(controller)();
      window.dispatchEvent(new Event('focus'));

      expect(globalThis.setInterval).not.toHaveBeenCalled();
      expect(globalThis.setTimeout).not.toHaveBeenCalled();
    });

    it('stops re-checking on focus after cleanup', () => {
      const cleanup = buildFocusEffect(controller)();

      cleanup();
      window.dispatchEvent(new Event('focus'));

      expect(controller.checkAgain).not.toHaveBeenCalled();
    });
  });
});
