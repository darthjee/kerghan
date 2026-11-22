import RateLimitCountdownController from '../../../../../../assets/js/components/common/forms/RateLimitCountdownController.js';

describe('RateLimitCountdownController', () => {
  let onChange;

  beforeEach(() => {
    jasmine.clock().install();
    onChange = jasmine.createSpy('onChange');
  });

  afterEach(() => jasmine.clock().uninstall());

  it('starts active with the label', () => {
    const controller = new RateLimitCountdownController(3, onChange);

    expect(controller.state).toEqual({ active: true, secondsLeft: 3, label: 'Try again in 3 s' });
    controller.dispose();
  });

  it('ticks every second', () => {
    const controller = new RateLimitCountdownController(3, onChange);

    jasmine.clock().tick(1000);

    expect(onChange).toHaveBeenCalledWith({ active: true, secondsLeft: 2, label: 'Try again in 2 s' });
    controller.dispose();
  });

  it('re-enables at 0 and never calls anything else', () => {
    const controller = new RateLimitCountdownController(2, onChange);

    jasmine.clock().tick(5000);

    expect(controller.state).toEqual({ active: false, secondsLeft: 0, label: null });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('clears its timer on dispose', () => {
    const controller = new RateLimitCountdownController(5, onChange);

    controller.dispose();
    jasmine.clock().tick(5000);

    expect(onChange).not.toHaveBeenCalled();
  });

  [undefined, null, 0, -3, NaN, 'abc', Infinity].forEach((value) => {
    it(`is not active for ${String(value)}`, () => {
      const controller = new RateLimitCountdownController(value, onChange);

      jasmine.clock().tick(3000);

      expect(controller.state.active).toBeFalse();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  it('rounds fractions up', () => {
    const controller = new RateLimitCountdownController(1.2, onChange);

    expect(controller.state.secondsLeft).toBe(2);
    controller.dispose();
  });
});
