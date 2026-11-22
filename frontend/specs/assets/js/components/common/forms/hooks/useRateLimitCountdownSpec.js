import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import useRateLimitCountdown from '../../../../../../../assets/js/components/common/forms/hooks/useRateLimitCountdown.js';

describe('useRateLimitCountdown', () => {
  const renderCountdown = (retryAfterSeconds) => {
    let state;

    function Probe() {
      state = useRateLimitCountdown(retryAfterSeconds);
      return null;
    }

    renderToStaticMarkup(React.createElement(Probe));
    return state;
  };

  it('starts idle', () => {
    expect(renderCountdown(5)).toEqual({ active: false, secondsLeft: 0, label: null });
  });

  it('is idle without retryAfterSeconds', () => {
    expect(renderCountdown(undefined).active).toBeFalse();
  });
});
