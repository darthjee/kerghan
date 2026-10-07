import React from 'react';
import Sessions, { buildLoadEffect } from '../../../../../../../assets/js/components/resources/accounts/pages/Sessions.jsx';
import SessionsHelper from '../../../../../../../assets/js/components/resources/accounts/pages/helpers/SessionsHelper.jsx';
import SessionsController from '../../../../../../../assets/js/components/resources/accounts/pages/controllers/SessionsController.js';
import { renderCapturingHandlers } from '../../../../../../support/renderCapturingHandlers.js';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

describe('Sessions', () => {
  beforeEach(() => {
    spyOn(SessionsController.prototype, 'load').and.resolveTo();
  });

  it('passes the default state to the helper', () => {
    spyOn(SessionsHelper, 'render').and.returnValue(React.createElement('div', null, 'sessions-page'));

    const page = renderedOutput(React.createElement(Sessions));

    expect(page.contains('sessions-page')).toBeTrue();
    expect(SessionsHelper.render).toHaveBeenCalledWith(
      {
        sessions: [],
        loadError: null,
        rowState: new Map(),
        pageState: { confirmingRevokeOthers: false, error: null },
      },
      jasmine.objectContaining({
        onRevoke: jasmine.any(Function),
        onRequestRevokeOthers: jasmine.any(Function),
        onConfirmRevokeOthers: jasmine.any(Function),
        onCancelRevokeOthers: jasmine.any(Function),
      }),
    );
  });

  describe('buildLoadEffect', () => {
    it('triggers a load on the given controller', () => {
      const controller = jasmine.createSpyObj('controller', ['load']);
      controller.load.and.resolveTo();

      buildLoadEffect(controller)();

      expect(controller.load).toHaveBeenCalled();
    });
  });

  it('delegates revoke clicks to the controller for the given session id', async () => {
    spyOn(SessionsController.prototype, 'revoke').and.resolveTo();
    const handlers = renderCapturingHandlers(Sessions, SessionsHelper);

    await handlers.onRevoke('session-uuid')();

    expect(SessionsController.prototype.revoke).toHaveBeenCalledWith('session-uuid');
  });

  it('delegates the revoke-others request to the controller', () => {
    spyOn(SessionsController.prototype, 'requestRevokeOthers');
    const handlers = renderCapturingHandlers(Sessions, SessionsHelper);

    handlers.onRequestRevokeOthers();

    expect(SessionsController.prototype.requestRevokeOthers).toHaveBeenCalled();
  });

  it('delegates the revoke-others confirmation to the controller', async () => {
    spyOn(SessionsController.prototype, 'confirmRevokeOthers').and.resolveTo();
    const handlers = renderCapturingHandlers(Sessions, SessionsHelper);

    await handlers.onConfirmRevokeOthers();

    expect(SessionsController.prototype.confirmRevokeOthers).toHaveBeenCalled();
  });

  it('delegates the revoke-others cancellation to the controller', () => {
    spyOn(SessionsController.prototype, 'cancelRevokeOthers');
    const handlers = renderCapturingHandlers(Sessions, SessionsHelper);

    handlers.onCancelRevokeOthers();

    expect(SessionsController.prototype.cancelRevokeOthers).toHaveBeenCalled();
  });
});
