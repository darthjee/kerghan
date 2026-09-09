import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AuthorizationRequests, { buildLoadEffect } from '../../../../../../../assets/js/components/resources/accounts/pages/AuthorizationRequests.jsx';
import AuthorizationRequestsHelper from '../../../../../../../assets/js/components/resources/accounts/pages/helpers/AuthorizationRequestsHelper.jsx';
import AuthorizationRequestsController from '../../../../../../../assets/js/components/resources/accounts/pages/controllers/AuthorizationRequestsController.js';

describe('AuthorizationRequests', () => {
  it('passes the default state to the helper', () => {
    spyOn(AuthorizationRequestsController.prototype, 'load').and.resolveTo();
    spyOn(AuthorizationRequestsHelper, 'render').and.returnValue(React.createElement('div', null, 'authorization-requests'));

    const html = renderToStaticMarkup(React.createElement(AuthorizationRequests));

    expect(html).toContain('authorization-requests');
    expect(AuthorizationRequestsHelper.render).toHaveBeenCalledWith(
      { requests: [], loadError: null, rowState: {} },
      jasmine.objectContaining({
        onToggleAuthorize: jasmine.any(Function),
        onPasswordChange: jasmine.any(Function),
        onConfirmAuthorize: jasmine.any(Function),
        onDeny: jasmine.any(Function),
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

  it('delegates deny clicks to the controller for the given request uuid', async () => {
    spyOn(AuthorizationRequestsController.prototype, 'load').and.resolveTo();
    spyOn(AuthorizationRequestsController.prototype, 'deny').and.resolveTo();
    let capturedHandlers;
    spyOn(AuthorizationRequestsHelper, 'render').and.callFake((_state, handlers) => {
      capturedHandlers = handlers;
      return React.createElement('div');
    });

    renderToStaticMarkup(React.createElement(AuthorizationRequests));
    await capturedHandlers.onDeny('req-uuid')();

    expect(AuthorizationRequestsController.prototype.deny).toHaveBeenCalledWith('req-uuid');
  });

  it('delegates confirm-authorize clicks to the controller, preventing default navigation', async () => {
    spyOn(AuthorizationRequestsController.prototype, 'load').and.resolveTo();
    spyOn(AuthorizationRequestsController.prototype, 'authorize').and.resolveTo();
    let capturedHandlers;
    spyOn(AuthorizationRequestsHelper, 'render').and.callFake((_state, handlers) => {
      capturedHandlers = handlers;
      return React.createElement('div');
    });

    renderToStaticMarkup(React.createElement(AuthorizationRequests));
    const fakeEvent = { preventDefault: jasmine.createSpy('preventDefault') };
    await capturedHandlers.onConfirmAuthorize('req-uuid')(fakeEvent);

    expect(fakeEvent.preventDefault).toHaveBeenCalled();
    expect(AuthorizationRequestsController.prototype.authorize).toHaveBeenCalledWith('req-uuid', '');
  });

  it('toggles a row open locally, without reaching the controller', () => {
    spyOn(AuthorizationRequestsController.prototype, 'load').and.resolveTo();
    spyOn(AuthorizationRequestsController.prototype, 'authorize').and.resolveTo();
    spyOn(AuthorizationRequestsController.prototype, 'deny').and.resolveTo();
    let capturedHandlers;
    spyOn(AuthorizationRequestsHelper, 'render').and.callFake((_state, handlers) => {
      capturedHandlers = handlers;
      return React.createElement('div');
    });

    renderToStaticMarkup(React.createElement(AuthorizationRequests));

    expect(() => capturedHandlers.onToggleAuthorize('req-uuid')()).not.toThrow();
    expect(AuthorizationRequestsController.prototype.authorize).not.toHaveBeenCalled();
    expect(AuthorizationRequestsController.prototype.deny).not.toHaveBeenCalled();
  });

  it('updates a row\'s password locally, without reaching the controller', () => {
    spyOn(AuthorizationRequestsController.prototype, 'load').and.resolveTo();
    spyOn(AuthorizationRequestsController.prototype, 'authorize').and.resolveTo();
    spyOn(AuthorizationRequestsController.prototype, 'deny').and.resolveTo();
    let capturedHandlers;
    spyOn(AuthorizationRequestsHelper, 'render').and.callFake((_state, handlers) => {
      capturedHandlers = handlers;
      return React.createElement('div');
    });

    renderToStaticMarkup(React.createElement(AuthorizationRequests));

    expect(() => capturedHandlers.onPasswordChange('req-uuid')({ target: { value: 'secret' } }))
      .not.toThrow();
    expect(AuthorizationRequestsController.prototype.authorize).not.toHaveBeenCalled();
    expect(AuthorizationRequestsController.prototype.deny).not.toHaveBeenCalled();
  });
});
