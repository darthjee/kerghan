import React from 'react';
import Integrations, { buildLoadEffect } from '../../../../../../../assets/js/components/resources/accounts/pages/Integrations.jsx';
import IntegrationsHelper from '../../../../../../../assets/js/components/resources/accounts/pages/helpers/IntegrationsHelper.jsx';
import IntegrationsController, { CLOSED_ADD_FORM } from '../../../../../../../assets/js/components/resources/accounts/pages/controllers/IntegrationsController.js';
import { renderCapturingHandlers } from '../../../../../../support/renderCapturingHandlers.js';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

describe('Integrations', () => {
  it('passes the default state to the helper', () => {
    spyOn(IntegrationsController.prototype, 'load').and.resolveTo();
    spyOn(IntegrationsHelper, 'render').and.returnValue(React.createElement('div', null, 'integrations-page'));

    const page = renderedOutput(React.createElement(Integrations));

    expect(page.contains('integrations-page')).toBeTrue();
    expect(IntegrationsHelper.render).toHaveBeenCalledWith(
      {
        integrations: [],
        types: [],
        loadState: { loading: true, error: null },
        rowState: new Map(),
        addForm: CLOSED_ADD_FORM,
        notice: null,
        selection: null,
      },
      jasmine.objectContaining({ onRetry: jasmine.any(Function), onTest: jasmine.any(Function) }),
    );
  });

  it('wires the handlers to the page controller', () => {
    spyOn(IntegrationsController.prototype, 'test').and.resolveTo();
    const handlers = renderCapturingHandlers(Integrations, IntegrationsHelper);

    handlers.onTest('abc')();

    expect(IntegrationsController.prototype.test).toHaveBeenCalledWith('abc');
  });

  describe('buildLoadEffect', () => {
    it('triggers a load and disposes the controller on cleanup', () => {
      const controller = jasmine.createSpyObj('controller', ['load', 'dispose']);
      controller.load.and.resolveTo();

      const cleanup = buildLoadEffect(controller)();

      expect(controller.load).toHaveBeenCalled();
      expect(controller.dispose).not.toHaveBeenCalled();

      cleanup();

      expect(controller.dispose).toHaveBeenCalled();
    });
  });
});
