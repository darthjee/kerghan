import CooldownTimers from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/CooldownTimers.js';

describe('CooldownTimers', () => {
  const NOW = Date.parse('2026-10-01T12:00:00.000Z');
  let onExpire;
  let timers;

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(NOW));
    onExpire = jasmine.createSpy('onExpire');
    timers = new CooldownTimers(onExpire);
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('calls onExpire with the uuid when the cooldown ends', () => {
    timers.schedule('abc', NOW + 1000);

    jasmine.clock().tick(999);
    expect(onExpire).not.toHaveBeenCalled();

    jasmine.clock().tick(1);
    expect(onExpire).toHaveBeenCalledOnceWith('abc');
  });

  it('schedules nothing for a null or past end', () => {
    timers.schedule('abc', null);
    timers.schedule('def', NOW);
    jasmine.clock().tick(10000);

    expect(onExpire).not.toHaveBeenCalled();
  });

  it('keeps an existing timer ending later', () => {
    timers.schedule('abc', NOW + 5000);
    timers.schedule('abc', NOW + 1000);

    jasmine.clock().tick(1000);
    expect(onExpire).not.toHaveBeenCalled();

    jasmine.clock().tick(4000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('replaces an existing timer with a later one', () => {
    timers.schedule('abc', NOW + 1000);
    timers.schedule('abc', NOW + 5000);

    jasmine.clock().tick(1000);
    expect(onExpire).not.toHaveBeenCalled();

    jasmine.clock().tick(4000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('clears a single timer', () => {
    timers.schedule('abc', NOW + 1000);
    timers.schedule('def', NOW + 1000);
    timers.clear('abc');
    timers.clear('missing');

    jasmine.clock().tick(1000);
    expect(onExpire).toHaveBeenCalledOnceWith('def');
  });

  it('clears every timer', () => {
    timers.schedule('abc', NOW + 1000);
    timers.schedule('def', NOW + 2000);
    timers.clearAll();

    jasmine.clock().tick(2000);
    expect(onExpire).not.toHaveBeenCalled();
  });
});
