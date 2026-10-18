import React from 'react';
import AwaitingApprovalHelper from '../../../../../../../assets/js/components/common/awaitingApproval/helpers/AwaitingApprovalHelper.jsx';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';
import { findButton } from '../../../../../../support/elementTree.js';

describe('AwaitingApprovalHelper', () => {
  let handlers;

  const render = (state = { error: null }) => AwaitingApprovalHelper.render(state, handlers);

  beforeEach(() => {
    handlers = jasmine.createSpyObj('handlers', ['onCheckAgain', 'onLogout']);
  });

  it("says the account is waiting for an administrator's approval", () => {
    const page = renderedOutput(render());

    expect(page.contains('waiting for an administrator')).toBeTrue();
  });

  it('never mentions a denial', () => {
    const page = renderedOutput(render());

    expect(page.contains('denied')).toBeFalse();
  });

  it('wires "Check again" to onCheckAgain', () => {
    findButton(render(), 'Check again').props.onClick();

    expect(handlers.onCheckAgain).toHaveBeenCalled();
  });

  it('wires "Log out" to onLogout', () => {
    findButton(render(), 'Log out').props.onClick();

    expect(handlers.onLogout).toHaveBeenCalled();
  });

  it('renders no error alert without an error', () => {
    const page = renderedOutput(render());

    expect(page.contains('alert-danger')).toBeFalse();
  });

  it('renders the error alert when there is one', () => {
    const page = renderedOutput(React.createElement('div', null, render({ error: 'boom' })));

    expect(page.containsElement('div', 'boom')).toBeTrue();
  });
});
