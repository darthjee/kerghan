import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import useDirtyFormGuard from '../../../../../../../assets/js/components/common/forms/hooks/useDirtyFormGuard.js';

describe('useDirtyFormGuard', () => {
  const renderGuard = (isDirty) => {
    let guard;

    function Probe() {
      guard = useDirtyFormGuard(isDirty);
      return null;
    }

    renderToStaticMarkup(React.createElement(Probe));
    return guard;
  };

  it('starts with nothing pending', () => {
    expect(renderGuard(true).pendingHash).toBeNull();
  });

  it('exposes leave, confirmLeave and cancelLeave', () => {
    expect(renderGuard(false)).toEqual(jasmine.objectContaining({
      leave: jasmine.any(Function), confirmLeave: jasmine.any(Function), cancelLeave: jasmine.any(Function),
      forceLeave: jasmine.any(Function),
    }));
  });
});
