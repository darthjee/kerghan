import { buildAuthEffect } from '../../../../../../../assets/js/components/common/header/hooks/useAuthEffect.js';
import AuthEvents from '../../../../../../../assets/js/client/AuthEvents.js';

describe('useAuthEffect', () => {
  let controller;
  let setLoggedIn;
  let originalWindow;

  beforeEach(() => {
    // Node-based Jasmine specs run without a DOM, so `window` is undefined there; a plain
    // `EventTarget` provides the same `addEventListener`/`removeEventListener`/`dispatchEvent`
    // shape AuthEvents relies on (matches AuthEventsSpec.js's setup).
    originalWindow = globalThis.window;
    globalThis.window = new EventTarget();
    controller = jasmine.createSpyObj('controller', ['checkStatus']);
    controller.checkStatus.and.resolveTo();
    setLoggedIn = jasmine.createSpy('setLoggedIn');
    spyOn(AuthEvents, 'subscribe').and.callThrough();
    spyOn(AuthEvents, 'unsubscribe').and.callThrough();
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  describe('buildAuthEffect', () => {
    it('subscribes to AuthEvents on mount', () => {
      buildAuthEffect(controller, setLoggedIn)();

      expect(AuthEvents.subscribe).toHaveBeenCalledWith(jasmine.any(Function));
    });

    it("triggers the controller's mount-time status check", () => {
      buildAuthEffect(controller, setLoggedIn)();

      expect(controller.checkStatus).toHaveBeenCalled();
    });

    it('updates state when AuthEvents emits a change', () => {
      buildAuthEffect(controller, setLoggedIn)();

      AuthEvents.emit(true);

      expect(setLoggedIn).toHaveBeenCalledWith(true);
    });

    it('unsubscribes from AuthEvents on cleanup', () => {
      const cleanup = buildAuthEffect(controller, setLoggedIn)();

      cleanup();

      expect(AuthEvents.unsubscribe).toHaveBeenCalledWith(jasmine.any(Function));
    });

    it('does not update state once cleanup has run', () => {
      const cleanup = buildAuthEffect(controller, setLoggedIn)();
      const handleAuthChanged = AuthEvents.subscribe.calls.mostRecent().args[0];

      cleanup();
      // Invoke the captured handler directly (bypassing AuthEvents.unsubscribe) to exercise the
      // `mounted` guard itself, independent of the real unsubscription already covered above —
      // guards against a status check resolving after the component has unmounted.
      handleAuthChanged({ detail: { loggedIn: true } });

      expect(setLoggedIn).not.toHaveBeenCalled();
    });
  });
});
