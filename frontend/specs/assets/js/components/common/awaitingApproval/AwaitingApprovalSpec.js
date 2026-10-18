import React from 'react';
import AwaitingApproval from '../../../../../../assets/js/components/common/awaitingApproval/AwaitingApproval.jsx';
import AwaitingApprovalHelper from '../../../../../../assets/js/components/common/awaitingApproval/helpers/AwaitingApprovalHelper.jsx';
import AwaitingApprovalController from '../../../../../../assets/js/components/common/awaitingApproval/controllers/AwaitingApprovalController.js';
import { renderCapturingHandlers } from '../../../../../support/renderCapturingHandlers.js';
import { renderedOutput } from '../../../../../support/renderedOutput.js';

describe('AwaitingApproval', () => {
  it('passes the initial state to the helper', () => {
    spyOn(AwaitingApprovalHelper, 'render').and.returnValue(React.createElement('div', null, 'awaiting'));

    const page = renderedOutput(React.createElement(AwaitingApproval));

    expect(page.contains('awaiting')).toBeTrue();
    expect(AwaitingApprovalHelper.render).toHaveBeenCalledWith(
      { error: null },
      { onCheckAgain: jasmine.any(Function), onLogout: jasmine.any(Function) },
    );
  });

  it('delegates "Check again" to the controller', async () => {
    spyOn(AwaitingApprovalController.prototype, 'checkAgain').and.resolveTo();
    const handlers = renderCapturingHandlers(AwaitingApproval, AwaitingApprovalHelper);

    await handlers.onCheckAgain();

    expect(AwaitingApprovalController.prototype.checkAgain).toHaveBeenCalled();
  });

  it('delegates "Log out" to the controller', async () => {
    spyOn(AwaitingApprovalController.prototype, 'logout').and.resolveTo(true);
    const handlers = renderCapturingHandlers(AwaitingApproval, AwaitingApprovalHelper);

    await handlers.onLogout();

    expect(AwaitingApprovalController.prototype.logout).toHaveBeenCalled();
  });
});
