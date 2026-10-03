import { renderToStaticMarkup } from 'react-dom/server';
import IntegrationsHelper from '../../../../../../../../assets/js/components/resources/accounts/pages/helpers/IntegrationsHelper.jsx';
import IntegrationsHandlers from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/IntegrationsHandlers.js';
import PatType from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/types/pat.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../support/fakeWindow.js';
import { findElements } from '../../../../../../../support/elementTree.js';
import { CANARY, buildIntegration, useIntegrationsControllerHarness } from '../../../../../../../support/integrationsControllerHarness.js';

describe('IntegrationsHelper canary credential', () => {
  const context = useIntegrationsControllerHarness();
  let consoleSpies;
  let storage;
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
    installFakeWindow({ location: { hash: '#/account/integrations', href: 'http://localhost/#/account/integrations' } });
    Object.assign(context.state, {
      types: [PatType],
      loadState: { loading: false, error: null },
      addForm: { open: true, type: 'pat', label: 'Work', credential: {}, error: null },
    });
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

  const renderPage = (controller) => IntegrationsHelper.render(
    context.state,
    IntegrationsHandlers.build(controller, context.state),
  );

  const typeAndSubmit = async (controller) => {
    const tokenInput = findElements(renderPage(controller), (node) => node.props?.type === 'password')[0];
    tokenInput.props.onChange({ target: { value: CANARY } });

    const form = findElements(renderPage(controller), (node) => node.type === 'form')[0];
    await form.props.onSubmit({ preventDefault: () => undefined });
  };

  const expectCanaryNeverLeaked = () => {
    const seen = JSON.stringify([
      ...consoleSpies.map((spy) => spy.calls.allArgs()),
      storage.setItem.calls.allArgs(),
      globalThis.window.location,
    ]);
    const passwordValues = findElements(
      renderPage(context.buildController()),
      (node) => node.props?.type === 'password',
    ).map((input) => input.props.value);

    expect(seen).not.toContain(CANARY);
    expect(JSON.stringify(context.state.addForm)).not.toContain(CANARY);
    expect(passwordValues).not.toContain(CANARY);
  };

  it('sends the typed canary to the API only', async () => {
    context.client.create.and.resolveTo(buildIntegration());
    const controller = context.buildController();

    await typeAndSubmit(controller);

    expect(context.client.create).toHaveBeenCalledWith(jasmine.objectContaining({ credential: { token: CANARY } }));
  });

  it('never leaks the canary after a successful submit', async () => {
    context.client.create.and.resolveTo(buildIntegration());

    await typeAndSubmit(context.buildController());

    expectCanaryNeverLeaked();
  });

  it('never leaks the canary after a failed submit, and clears the input', async () => {
    context.client.create.and.rejectWith(new ApiError(422, 'invalid', 'INTEGRATION_CREDENTIAL_INVALID'));

    await typeAndSubmit(context.buildController());

    expect(context.state.addForm.open).toBeTrue();
    expectCanaryNeverLeaked();
  });

  describe('with a GitHub App selection', () => {
    const SELECT_STATE = 'SELECTcanary00000000';

    beforeEach(() => {
      context.state.selection = {
        state: SELECT_STATE,
        installations: [{ installationId: 7, accountLogin: 'acme', accountType: 'Organization' }],
      };
    });

    it('never renders the selection state, and drops it once an installation is chosen', async () => {
      context.client.selectGithubAppInstallation.and.resolveTo(buildIntegration({ type: 'github_app', githubLogin: 'acme' }));
      const controller = context.buildController();

      expect(renderToStaticMarkup(renderPage(controller))).not.toContain(SELECT_STATE);

      await IntegrationsHandlers.build(controller, context.state).onSelectInstallation(7)();

      expect(context.client.selectGithubAppInstallation).toHaveBeenCalledWith({ state: SELECT_STATE, installationId: 7 });
      expect(context.state.selection).toBeNull();
      expect(JSON.stringify([
        ...consoleSpies.map((spy) => spy.calls.allArgs()),
        storage.setItem.calls.allArgs(),
        globalThis.window.location,
        context.state,
      ])).not.toContain(SELECT_STATE);
    });
  });
});
