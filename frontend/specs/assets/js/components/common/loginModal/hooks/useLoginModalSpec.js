import { buildLoginModalEffect } from '../../../../../../../assets/js/components/common/loginModal/hooks/useLoginModal.js';
import LoginModalEvents from '../../../../../../../assets/js/client/LoginModalEvents.js';

describe('useLoginModal', () => {
  let controller;
  let setOpen;
  let setters;
  let originalWindow;

  beforeEach(() => {
    // Node-based Jasmine specs run without a DOM, so `window` is undefined there; a plain
    // `EventTarget` provides the same event-target shape LoginModalEvents relies on.
    originalWindow = globalThis.window;
    globalThis.window = new EventTarget();
    controller = jasmine.createSpyObj('controller', ['switchMode']);
    setOpen = jasmine.createSpy('setOpen');
    setters = { setOpen };
    spyOn(LoginModalEvents, 'subscribe').and.callThrough();
    spyOn(LoginModalEvents, 'unsubscribe').and.callThrough();
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  describe('buildLoginModalEffect', () => {
    it('subscribes to LoginModalEvents on mount', () => {
      buildLoginModalEffect(controller, setters)();

      expect(LoginModalEvents.subscribe).toHaveBeenCalledWith(jasmine.any(Function));
    });

    it('opens the modal and switches to the requested mode on an open event', () => {
      buildLoginModalEffect(controller, setters)();

      LoginModalEvents.open('register');

      expect(setOpen).toHaveBeenCalledWith(true);
      expect(controller.switchMode).toHaveBeenCalledWith('register');
    });

    it('closes the modal without switching mode on a close event', () => {
      buildLoginModalEffect(controller, setters)();

      LoginModalEvents.close();

      expect(setOpen).toHaveBeenCalledWith(false);
      expect(controller.switchMode).not.toHaveBeenCalled();
    });

    it('unsubscribes from LoginModalEvents on cleanup', () => {
      const cleanup = buildLoginModalEffect(controller, setters)();

      cleanup();

      expect(LoginModalEvents.unsubscribe).toHaveBeenCalledWith(jasmine.any(Function));
    });

    it('does not update state once cleanup has run', () => {
      const cleanup = buildLoginModalEffect(controller, setters)();
      const handleToggle = LoginModalEvents.subscribe.calls.mostRecent().args[0];

      cleanup();
      // Invoke the captured handler directly to exercise the `mounted` guard itself,
      // independent of the real unsubscription already covered above.
      handleToggle({ detail: { open: true, mode: 'register' } });

      expect(setOpen).not.toHaveBeenCalled();
      expect(controller.switchMode).not.toHaveBeenCalled();
    });
  });
});
