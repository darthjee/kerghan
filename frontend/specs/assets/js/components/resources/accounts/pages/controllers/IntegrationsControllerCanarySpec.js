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

  describe('with a GitHub App selection state', () => {
    const SELECT_STATE = `${'0'.repeat(36)}.SELECTcanary${'x'.repeat(31)}`;
    const selection = { state: SELECT_STATE, installations: [{ installationId: 7, accountLogin: 'acme', accountType: 'Organization' }] };

    const expectSelectStateNeverLeaked = () => {
      const seen = JSON.stringify([
        ...consoleSpies.map((spy) => spy.calls.allArgs()),
        storage.setItem.calls.allArgs(),
        globalThis.window.location,
        context.state.selection,
        context.state.notice,
        context.state.integrations,
      ]);

      expect(seen).not.toContain(SELECT_STATE);
    };

    beforeEach(() => {
      context.state.selection = selection;
    });

    it('never leaks it after a successful select', async () => {
      context.client.selectGithubAppInstallation.and.resolveTo(buildIntegration({ type: 'github_app', githubLogin: 'acme' }));

      await context.buildController().selectInstallation(selection, 7);

      expectSelectStateNeverLeaked();
    });

    it('never leaks it after a failed select', async () => {
      context.client.selectGithubAppInstallation.and.rejectWith(
        new ApiError(422, 'raw', 'INTEGRATION_INSTALLATION_NOT_ACCESSIBLE'),
      );

      await context.buildController().selectInstallation(selection, 7);

      expectSelectStateNeverLeaked();
    });

    it('drops it on unmount', () => {
      context.buildController().dispose();

      expectSelectStateNeverLeaked();
    });
  });

  it('never leaks a canary credential on a failed create and replace', async () => {
    const error = new ApiError(422, 'invalid', 'INTEGRATION_CREDENTIAL_INVALID');
    context.client.create.and.rejectWith(error);
    context.client.replaceCredential.and.rejectWith(error);

    await submitBoth();

    expectCanaryNeverLeaked();
  });
});
