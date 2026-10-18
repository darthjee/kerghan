import React from 'react';
import ApproveUserButton from '../../../../../../../../assets/js/components/resources/admin/pages/users/ApproveUserButton.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('ApproveUserButton', () => {
  let onApprove;

  const renderButton = (user) => renderedOutput(
    React.createElement(ApproveUserButton, { user, onApprove }),
  );

  beforeEach(() => {
    onApprove = jasmine.createSpy('onApprove').and.returnValue(jasmine.createSpy('handler'));
  });

  it('renders the Approve button for a pending user', () => {
    const output = renderButton({ id: 1, status: 'pending' });

    expect(output.containsElement('button', 'Approve')).toBeTrue();
    expect(onApprove).toHaveBeenCalledWith(1);
  });

  it('renders nothing for an approved user', () => {
    expect(renderButton({ id: 1, status: 'approved' }).isEmpty()).toBeTrue();
  });

  it('renders nothing for a denied user', () => {
    expect(renderButton({ id: 1, status: 'denied' }).isEmpty()).toBeTrue();
  });
});
