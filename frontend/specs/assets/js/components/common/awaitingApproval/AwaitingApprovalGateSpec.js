import React from 'react';
import AwaitingApprovalGate from '../../../../../../assets/js/components/common/awaitingApproval/AwaitingApprovalGate.jsx';
import { renderedOutput } from '../../../../../support/renderedOutput.js';

describe('AwaitingApprovalGate', () => {
  const renderGate = (pending) => renderedOutput(
    React.createElement(AwaitingApprovalGate, { pending }, React.createElement('p', null, 'the app')),
  );

  it('renders the awaiting-approval view instead of the app while pending', () => {
    const page = renderGate(true);

    expect(page.contains('Awaiting approval')).toBeTrue();
    expect(page.contains('the app')).toBeFalse();
  });

  it('renders the app once no longer pending', () => {
    const page = renderGate(false);

    expect(page.contains('the app')).toBeTrue();
    expect(page.contains('Awaiting approval')).toBeFalse();
  });
});
