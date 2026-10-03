import IntegrationsController, { CLOSED_ADD_FORM } from '../../assets/js/components/resources/accounts/pages/controllers/IntegrationsController.js';

export const NOW = Date.parse('2026-10-01T12:00:00.000Z');
export const CANARY = 'ghp_CANARYcanary0000000000000000000000';

/**
 * Build an Integration API response, with defaults for the fields the controller reads.
 *
 * @param {object} [overrides] - Fields to override.
 * @returns {object} The integration.
 */
export function buildIntegration(overrides = {}) {
  return {
    id: 'abc-123',
    type: 'pat',
    label: 'Work',
    status: 'active',
    nextTestAt: null,
    ...overrides,
  };
}

/**
 * Registers `beforeEach`/`afterEach` hooks setting up an `IntegrationsController` harness: a
 * mocked clock at {@link NOW}, setter spies applying values (or updaters) to `context.state`, a
 * spied client, a `context.navigate` spy, and `context.buildController()`.
 *
 * @returns {object} The context, filled in before each spec.
 */
export function useIntegrationsControllerHarness() {
  const context = {};

  const apply = (key) => jasmine.createSpy(key).and.callFake((value) => {
    context.state[key] = typeof value === 'function' ? value(context.state[key]) : value;
  });

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(NOW));
    context.state = {
      integrations: [],
      types: [],
      loadState: { loading: true, error: null },
      rowState: new Map(),
      addForm: CLOSED_ADD_FORM,
      notice: null,
      selection: null,
    };
    context.setters = {
      setIntegrations: apply('integrations'),
      setTypes: apply('types'),
      setLoadState: apply('loadState'),
      setRowState: apply('rowState'),
      setAddForm: apply('addForm'),
      setNotice: apply('notice'),
      setSelection: apply('selection'),
    };
    context.client = jasmine.createSpyObj('client', [
      'listMine', 'listTypes', 'create', 'rename', 'replaceCredential', 'test', 'remove',
      'startOauthApp', 'completeOauthApp', 'startGithubApp', 'completeGithubApp',
      'selectGithubAppInstallation',
    ]);
    context.navigate = jasmine.createSpy('navigate');
    context.buildController = () => new IntegrationsController(
      context.setters, context.client, context.navigate,
    );
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  return context;
}
