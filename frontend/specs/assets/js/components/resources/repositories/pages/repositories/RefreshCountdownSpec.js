import RefreshCountdown from '../../../../../../../../assets/js/components/resources/repositories/pages/repositories/RefreshCountdown.js';

describe('RefreshCountdown', () => {
  const NOW = Date.parse('2026-11-07T12:00:00Z');
  let setNow;
  let countdown;

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(NOW));
    setNow = jasmine.createSpy('setNow');
    countdown = new RefreshCountdown(setNow);
  });

  afterEach(() => {
    countdown.stop();
    jasmine.clock().uninstall();
  });

  it('publishes the current time right away', () => {
    countdown.start(NOW + 3000);

    expect(setNow).toHaveBeenCalledWith(NOW);
  });

  it('ticks every second while the end is in the future', () => {
    countdown.start(NOW + 3000);
    jasmine.clock().tick(2000);

    expect(setNow).toHaveBeenCalledTimes(3);
  });

  it('stops ticking at zero', () => {
    countdown.start(NOW + 2000);
    jasmine.clock().tick(5000);

    expect(setNow).toHaveBeenCalledTimes(3);
  });

  it('does not tick for no cooldown', () => {
    countdown.start(null);
    jasmine.clock().tick(5000);

    expect(setNow).toHaveBeenCalledTimes(1);
  });

  it('does not tick for a cooldown already over', () => {
    countdown.start(NOW - 1);
    jasmine.clock().tick(5000);

    expect(setNow).toHaveBeenCalledTimes(1);
  });

  it('replaces a running ticker', () => {
    countdown.start(NOW + 10000);
    countdown.start(NOW + 10000);
    setNow.calls.reset();
    jasmine.clock().tick(1000);

    expect(setNow).toHaveBeenCalledTimes(1);
  });

  it('stops on demand', () => {
    countdown.start(NOW + 10000);
    countdown.stop();
    setNow.calls.reset();
    jasmine.clock().tick(5000);

    expect(setNow).not.toHaveBeenCalled();
  });
});
