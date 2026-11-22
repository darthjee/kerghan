import { buildLinkClockEffect } from '../../../../../../../assets/js/components/resources/issues/link/useLinkClock.js';

describe('useLinkClock', () => {
  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-11-07T12:00:00.000Z'));
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('publishes the time at once, ticks every 30 s and stops on cleanup', () => {
    const setNow = jasmine.createSpy('setNow');
    const cleanup = buildLinkClockEffect(setNow)();

    expect(setNow).toHaveBeenCalledTimes(1);
    jasmine.clock().tick(30000);
    expect(setNow).toHaveBeenCalledTimes(2);

    cleanup();
    jasmine.clock().tick(60000);
    expect(setNow).toHaveBeenCalledTimes(2);
  });
});
