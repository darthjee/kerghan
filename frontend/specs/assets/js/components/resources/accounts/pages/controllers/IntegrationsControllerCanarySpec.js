import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../support/fakeWindow.js';
import {
  CANARY, buildIntegration, useIntegrationsControllerHarness,
} from '../../../../../../../support/integrationsControllerHarness.js';

describe('IntegrationsController canary credential', () => {
  const context = useIntegrationsControllerHarness();
  let storage;
  let consoleSpies;
  let originalStorages;

  beforeEach(() => {
    consoleSpies = ['log', 'info', 'warn', 'error', 'debug'].map((method) => spyOn(console, method));
    storage = jasmine.createSpyObj('storage', ['setItem', 'getItem', 'removeItem']);
    originalStorages = ['localStorage', 'sessionStorage'].map(
      (name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)],
    );
    originalStorages.forEach(([name]) => Object.defineProperty(
      globalThis, name, { value: storage, configurable: true, writable: true },
    ));
    installFakeWindow({ location: { hash: '#/account/integrations' } });
  });

  afterEach(() => {
    uninstallFakeWindow();
    originalStorages.forEach(([name, descriptor]) => {
      if (descriptor) {
        Object.defineProperty(globalThis, name, descriptor);
      } else {
        delete globalThis[name];
      }
    });
  });

  const expectCanaryNeverLeaked = () => {
    const seen = JSON.stringify([
      ...consoleSpies.map((spy) => spy.calls.allArgs()),
      storage.setItem.calls.allArgs(),
      globalThis.window.location,
    ]);

    expect(seen).not.toContain(CANARY);
    expect(JSON.stringify([...context.state.rowState.values(), context.state.addForm])).not.toContain(CANARY);
  };

  const submitBoth = async () => {
    const controller = context.buildController();
    context.state.rowState = new Map([['abc-123', { replacing: true, credential: { token: CANARY } }]]);
    context.state.addForm = { open: true, type: 'pat', label: 'Work', credential: { token: CANARY } };

    await controller.create({ type: 'pat', label: 'Work', credential: { token: CANARY } });
    await controller.replaceCredential(buildIntegration(), { token: CANARY });
  };

  it('never leaks a canary credential on a successful create and replace', async () => {
    context.client.create.and.resolveTo(buildIntegration());
    context.client.replaceCredential.and.resolveTo(buildIntegration());

    await submitBoth();

    expectCanaryNeverLeaked();
  });

  it('never leaks a canary credential on a failed create and replace', async () => {
    const error = new ApiError(422, 'invalid', 'INTEGRATION_CREDENTIAL_INVALID');
    context.client.create.and.rejectWith(error);
    context.client.replaceCredential.and.rejectWith(error);

    await submitBoth();

    expectCanaryNeverLeaked();
  });
});
