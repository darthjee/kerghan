import FocusRereadThrottle from '../../../../../../../assets/js/components/resources/issues/sync/FocusRereadThrottle.js';
import { buildFocusRereadEffect } from '../../../../../../../assets/js/components/resources/issues/sync/useFocusReread.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

describe('FocusRereadThrottle', () => {
  let reread;
  let clock;
  let throttle;

  beforeEach(() => {
    reread = jasmine.createSpy('reread');
    clock = 1000;
    throttle = new FocusRereadThrottle({ reread, now: () => clock });
  });

  it('re-reads on the first focus', () => {
    expect(throttle.handleFocus()).toBeTrue();
    expect(reread).toHaveBeenCalledTimes(1);
  });

  it('throttles a focus within 30 s', () => {
    throttle.handleFocus();
    clock += 29999;

    expect(throttle.handleFocus()).toBeFalse();
    expect(reread).toHaveBeenCalledTimes(1);
  });

  it('re-reads again once 30 s passed', () => {
    throttle.handleFocus();
    clock += 30000;

    expect(throttle.handleFocus()).toBeTrue();
    expect(reread).toHaveBeenCalledTimes(2);
  });

  it('defaults to the real clock', () => {
    const real = new FocusRereadThrottle({ reread });

    expect(real.handleFocus()).toBeTrue();
    expect(real.handleFocus()).toBeFalse();
  });

  describe('with a window', () => {
    let target;

    beforeEach(() => {
      target = installFakeWindow(new EventTarget());
    });

    afterEach(() => {
      uninstallFakeWindow();
    });

    it('listens to focus and stops on dispose', () => {
      throttle.attach(target);
      target.dispatchEvent(new Event('focus'));
      throttle.dispose();
      clock += 60000;
      target.dispatchEvent(new Event('focus'));

      expect(reread).toHaveBeenCalledTimes(1);
    });

    it('attaches once when attached twice', () => {
      throttle.attach(target);
      throttle.attach(target);
      target.dispatchEvent(new Event('focus'));

      expect(reread).toHaveBeenCalledTimes(1);
    });

    it('disposes safely when not attached', () => {
      expect(() => throttle.dispose()).not.toThrow();
    });

    describe('buildFocusRereadEffect', () => {
      it('does not re-read on mount, re-reads on focus, throttled to 30 s', () => {
        buildFocusRereadEffect(reread, () => clock)();

        expect(reread).not.toHaveBeenCalled();

        window.dispatchEvent(new Event('focus'));
        window.dispatchEvent(new Event('focus'));

        expect(reread).toHaveBeenCalledTimes(1);
      });

      it('stops on cleanup', () => {
        const cleanup = buildFocusRereadEffect(reread, () => clock)();

        cleanup();
        window.dispatchEvent(new Event('focus'));

        expect(reread).not.toHaveBeenCalled();
      });
    });
  });
});
