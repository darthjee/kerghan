import LinkClockTicker from '../../../../../../../assets/js/components/resources/issues/link/LinkClockTicker.js';

describe('LinkClockTicker', () => {
  let setNow;
  let ticker;

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-11-07T12:00:00.000Z'));
    setNow = jasmine.createSpy('setNow');
    ticker = new LinkClockTicker(setNow);
  });

  afterEach(() => {
    ticker.stop();
    jasmine.clock().uninstall();
  });

  it('publishes the time at once', () => {
    ticker.start();

    expect(setNow).toHaveBeenCalledOnceWith(Date.parse('2026-11-07T12:00:00.000Z'));
  });

  it('ticks every 30 s', () => {
    ticker.start();
    jasmine.clock().tick(29999);
    expect(setNow).toHaveBeenCalledTimes(1);

    jasmine.clock().tick(1);
    expect(setNow).toHaveBeenCalledTimes(2);

    jasmine.clock().tick(30000);
    expect(setNow).toHaveBeenCalledTimes(3);
  });

  it('replaces a running ticker when started again', () => {
    ticker.start();
    ticker.start();
    setNow.calls.reset();

    jasmine.clock().tick(30000);

    expect(setNow).toHaveBeenCalledTimes(1);
  });

  it('stops on dispose', () => {
    ticker.start();
    ticker.stop();
    setNow.calls.reset();

    jasmine.clock().tick(120000);

    expect(setNow).not.toHaveBeenCalled();
  });
});
