import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import Cooldown from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/cooldown.js';
import {
  NOW, buildIntegration, useIntegrationsControllerHarness,
} from '../../../../../../../support/integrationsControllerHarness.js';

describe('IntegrationsController cooldown', () => {
  const context = useIntegrationsControllerHarness();
  let state;
  let setters;
  let client;
  const buildController = () => context.buildController();

  beforeEach(() => {
    ({ state, setters, client } = context);
  });

  describe('cooldown', () => {
    const isCoolingDown = (uuid = 'abc-123') => Cooldown.isActive(
      state.integrations.find(({ id }) => id === uuid),
      state.rowState.get(uuid),
    );

    it('is active until nextTestAt after a test, then re-renders when it ends', async () => {
      state.integrations = [buildIntegration()];
      client.test.and.resolveTo(buildIntegration({ nextTestAt: new Date(NOW + 30000).toISOString() }));

      await buildController().test('abc-123');

      expect(isCoolingDown()).toBeTrue();
      setters.setRowState.calls.reset();

      jasmine.clock().tick(30000);

      expect(setters.setRowState).toHaveBeenCalled();
      expect(isCoolingDown()).toBeFalse();
    });

    it('is active for a loaded integration whose nextTestAt is in the future', async () => {
      client.listMine.and.resolveTo({
        integrations: [buildIntegration({ nextTestAt: new Date(NOW + 10000).toISOString() })],
      });
      client.listTypes.and.resolveTo({ types: [] });

      await buildController().load();

      expect(isCoolingDown()).toBeTrue();
      jasmine.clock().tick(10000);
      expect(isCoolingDown()).toBeFalse();
    });

    it('is inactive when nextTestAt is in the past or null', async () => {
      client.listMine.and.resolveTo({
        integrations: [
          buildIntegration({ nextTestAt: new Date(NOW - 1000).toISOString() }),
          buildIntegration({ id: 'never', nextTestAt: null }),
        ],
      });
      client.listTypes.and.resolveTo({ types: [] });

      await buildController().load();

      expect(isCoolingDown()).toBeFalse();
      expect(isCoolingDown('never')).toBeFalse();
    });

    it('is active for Retry-After seconds after a 429, then re-renders when it ends', async () => {
      state.integrations = [buildIntegration()];
      client.test.and.rejectWith(new ApiError(429, 'Too soon', 'INTEGRATION_TEST_COOLDOWN', undefined, 20));

      await buildController().test('abc-123');

      expect(isCoolingDown()).toBeTrue();
      expect(state.rowState.get('abc-123').error)
        .toBe('This integration was tested recently. Try again in 20 seconds.');

      jasmine.clock().tick(19999);
      expect(isCoolingDown()).toBeTrue();

      jasmine.clock().tick(1);
      expect(state.rowState.get('abc-123').cooldownUntil).toBeNull();
      expect(isCoolingDown()).toBeFalse();
    });

    it('does not start a cooldown for a 429 without Retry-After', async () => {
      state.integrations = [buildIntegration()];
      client.test.and.rejectWith(new ApiError(429, 'Too soon', 'INTEGRATION_TEST_COOLDOWN'));

      await buildController().test('abc-123');

      expect(isCoolingDown()).toBeFalse();
      expect(state.rowState.get('abc-123').error)
        .toBe('This integration was tested recently. Try again shortly.');
    });

    it('cancels pending timers on dispose', async () => {
      state.integrations = [buildIntegration()];
      client.test.and.resolveTo(buildIntegration({ nextTestAt: new Date(NOW + 30000).toISOString() }));
      const controller = buildController();

      await controller.test('abc-123');
      setters.setRowState.calls.reset();
      controller.dispose();
      jasmine.clock().tick(30000);

      expect(setters.setRowState).not.toHaveBeenCalled();
    });

    it('cancels the row timer when the integration is removed', async () => {
      state.integrations = [buildIntegration()];
      client.test.and.resolveTo(buildIntegration({ nextTestAt: new Date(NOW + 30000).toISOString() }));
      client.remove.and.resolveTo({});
      const controller = buildController();

      await controller.test('abc-123');
      await controller.remove('abc-123');
      setters.setRowState.calls.reset();
      jasmine.clock().tick(30000);

      expect(setters.setRowState).not.toHaveBeenCalled();
    });
  });

});
