import React from 'react';
import DenyUserButton from '../../../../../../../../assets/js/components/resources/admin/pages/users/DenyUserButton.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('DenyUserButton', () => {
  let onDeny;

  const renderButton = (user, currentUserId = 99) => renderedOutput(
    React.createElement(DenyUserButton, { user, currentUserId, onDeny }),
  );

  beforeEach(() => {
    onDeny = jasmine.createSpy('onDeny').and.returnValue(jasmine.createSpy('handler'));
  });

  it('renders the Deny button for a pending user', () => {
    const output = renderButton({ id: 1, status: 'pending' });

    expect(output.containsElement('button', 'Deny')).toBeTrue();
    expect(onDeny).toHaveBeenCalledWith(1);
  });

  it('renders the Deny button for an approved user', () => {
    expect(renderButton({ id: 1, status: 'approved' }).containsElement('button', 'Deny')).toBeTrue();
  });

  it('renders nothing for a denied user', () => {
    expect(renderButton({ id: 1, status: 'denied' }).isEmpty()).toBeTrue();
  });

  it('renders nothing on the calling admin\'s own row', () => {
    expect(renderButton({ id: 99, status: 'approved' }, 99).isEmpty()).toBeTrue();
  });
});
