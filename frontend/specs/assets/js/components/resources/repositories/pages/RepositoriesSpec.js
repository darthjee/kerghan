import React from 'react';
import Repositories, { buildLoadEffect } from '../../../../../../../assets/js/components/resources/repositories/pages/Repositories.jsx';
import RepositoriesController, { INITIAL_QUERY } from '../../../../../../../assets/js/components/resources/repositories/pages/controllers/RepositoriesController.js';
import RepositoriesHelper from '../../../../../../../assets/js/components/resources/repositories/pages/helpers/RepositoriesHelper.jsx';
import { renderCapturingHandlers } from '../../../../../../support/renderCapturingHandlers.js';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

describe('Repositories', () => {
  it('passes the default state to the helper', () => {
    spyOn(RepositoriesController.prototype, 'load').and.resolveTo();
    spyOn(RepositoriesHelper, 'render').and.returnValue(React.createElement('div', null, 'repositories-page'));

    const page = renderedOutput(React.createElement(Repositories));

    expect(page.contains('repositories-page')).toBeTrue();
    expect(RepositoriesHelper.render).toHaveBeenCalledWith(
      jasmine.objectContaining({
        sync: null,
        query: INITIAL_QUERY,
        loadState: { loading: true, error: null },
        addState: new Map(),
        dismissed: new Set(),
        refreshNotice: null,
        cooldownUntil: null,
      }),
      jasmine.objectContaining({ onRefresh: jasmine.any(Function), onAdd: jasmine.any(Function) }),
    );
  });

  it('wires the handlers to the page controller', () => {
    spyOn(RepositoriesController.prototype, 'add').and.resolveTo();
    const handlers = renderCapturingHandlers(Repositories, RepositoriesHelper);

    handlers.onAdd(7)();

    expect(RepositoriesController.prototype.add).toHaveBeenCalledWith(7);
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
