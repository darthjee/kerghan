import IntegrationsClient from '../../../../../client/IntegrationsClient.js';
import Cooldown from '../integrations/cooldown.js';
import CooldownTimers from '../integrations/CooldownTimers.js';
import IntegrationErrors from '../integrations/errorMessages.js';
import IntegrationTypes from '../integrations/types/index.js';

/**
 * Initial (closed) state of the "Add integration" form.
 *
 * @type {{open: boolean, type: (string|null), label: string, credential: object,
 *   error: (string|null)}}
 */
export const CLOSED_ADD_FORM = Object.freeze({
  open: false, type: null, label: '', credential: {}, error: null,
});

/**
 * Controller for the "My account → Integrations" page: loads the caller's integrations and the
 * enabled types, and performs create, rename, replace credential, remove and test.
 *
 * @description Every method reaching {@link IntegrationsClient} treats an `undefined` result
 * (session expired, the login modal is already open) by returning without touching state.
 * Credentials are cleared from form state as soon as they are submitted, whatever the outcome,
 * and are never logged, persisted or put in the URL.
 */
export default class IntegrationsController {
  /**
   * Create an Integrations controller.
   *
   * @param {{setIntegrations: Function, setTypes: Function, setLoadState: Function,
   *   setRowState: Function, setAddForm: Function}} setters - React state setters: the
   *   integrations list, the available type definitions, the `{loading, error}` load state,
   *   the per-row UI state `Map` (keyed by uuid) and the add form state.
   * @param {typeof IntegrationsClient} [client] - Integrations HTTP client override, for
   *   testability.
   */
  constructor(setters, client = IntegrationsClient) {
    Object.assign(this, setters);
    this.client = client;
    this.timers = new CooldownTimers((uuid) => this.patchRow(uuid, { cooldownUntil: null }));
  }

  /**
   * Load the caller's integrations and the enabled types, or store the load error.
   *
   * @returns {Promise<void>} Resolves once the load finishes.
   */
  async load() {
    try {
      const [mine, enabled] = await Promise.all([this.client.listMine(), this.client.listTypes()]);

      if (!mine || !enabled) {
        return;
      }

      this.setIntegrations(mine.integrations);
      this.setTypes(IntegrationTypes.available(enabled.types));
      mine.integrations.forEach((integration) => this.#trackCooldown(integration));
      this.setLoadState({ loading: false, error: null });
    } catch (error) {
      this.setLoadState({ loading: false, error: IntegrationErrors.messageFor(error) });
    }
  }

  /**
   * Retry a failed load, showing the loading state again meanwhile.
   *
   * @returns {Promise<void>} Resolves once the load finishes.
   */
  async retry() {
    this.setLoadState({ loading: true, error: null });
    return this.load();
  }

  /**
   * Create an integration from the add form, prepending it to the list and closing the form on
   * success, or storing the form error on failure. The credential is cleared from the form
   * right away.
   *
   * @param {{type: string, label: string, credential: object}} form - The add form state.
   * @returns {Promise<void>} Resolves once the request finishes.
   */
  async create({ type, label, credential }) {
    this.patchAddForm({ credential: {}, error: null });

    try {
      const integration = await this.client.create({
        label, type, credential: IntegrationTypes.get(type).buildCredential(credential),
      });

      if (!integration) {
        return;
      }

      this.setIntegrations((current) => [integration, ...current]);
      this.#trackCooldown(integration);
      this.setAddForm(CLOSED_ADD_FORM);
    } catch (error) {
      this.patchAddForm({ error: IntegrationErrors.messageFor(error) });
    }
  }

  /**
   * Rename an integration.
   *
   * @param {string} uuid - The integration's uuid.
   * @param {string} label - The new label.
   * @returns {Promise<void>} Resolves once the request finishes.
   */
  async rename(uuid, label) {
    return this.#rowAction(uuid, () => this.client.rename(uuid, label), (integration) => {
      this.#replaceIntegration(integration);
      this.patchRow(uuid, { renaming: false, error: null });
    });
  }

  /**
   * Replace an integration's credential. The credential is cleared from the row right away.
   *
   * @param {{id: string, type: string}} integration - The integration.
   * @param {object} values - The credential form values.
   * @returns {Promise<void>} Resolves once the request finishes.
   */
  async replaceCredential({ id, type }, values) {
    this.patchRow(id, { credential: {} });

    return this.#rowAction(
      id,
      () => this.client.replaceCredential(id, IntegrationTypes.get(type).buildCredential(values)),
      (updated) => {
        this.#replaceIntegration(updated);
        this.patchRow(id, { replacing: false, error: null });
      },
    );
  }

  /**
   * Remove an integration, dropping its row on success.
   *
   * @param {string} uuid - The integration's uuid.
   * @returns {Promise<void>} Resolves once the request finishes.
   */
  async remove(uuid) {
    return this.#rowAction(uuid, () => this.client.remove(uuid), () => {
      this.setIntegrations((current) => current.filter(({ id }) => id !== uuid));
      this.timers.clear(uuid);
      this.setRowState((current) => {
        const next = new Map(current);
        next.delete(uuid);
        return next;
      });
    });
  }

  /**
   * Test an integration's connection. On a `429` carrying `Retry-After`, *Test* stays disabled
   * for that many seconds.
   *
   * @param {string} uuid - The integration's uuid.
   * @returns {Promise<void>} Resolves once the request finishes.
   */
  async test(uuid) {
    return this.#rowAction(
      uuid,
      () => this.client.test(uuid),
      (integration) => {
        this.#replaceIntegration(integration);
        this.patchRow(uuid, { error: null });
      },
      (error) => this.#startRetryCooldown(uuid, error),
    );
  }

  /**
   * Merge a patch into a row's UI state, always producing a new `Map`.
   *
   * @param {string} uuid - The integration's uuid.
   * @param {object} patch - Fields to merge into the row state.
   * @returns {void} Nothing.
   */
  patchRow(uuid, patch) {
    this.setRowState((current) => new Map(current).set(uuid, { ...current.get(uuid), ...patch }));
  }

  /**
   * Merge a patch into the add form state.
   *
   * @param {object} patch - Fields to merge into the add form state.
   * @returns {void} Nothing.
   */
  patchAddForm(patch) {
    this.setAddForm((current) => ({ ...current, ...patch }));
  }

  /**
   * Cancel every pending cooldown timer (on unmount).
   *
   * @returns {void} Nothing.
   */
  dispose() {
    this.timers.clearAll();
  }

  async #rowAction(uuid, apiCall, onSuccess, onError = () => undefined) {
    try {
      const result = await apiCall();

      if (!result) {
        return;
      }

      onSuccess(result);
    } catch (error) {
      this.patchRow(uuid, { error: IntegrationErrors.messageFor(error) });
      onError(error);
    }
  }

  #replaceIntegration(updated) {
    this.setIntegrations((current) => current.map(
      (integration) => (integration.id === updated.id ? updated : integration),
    ));
    this.#trackCooldown(updated);
  }

  #trackCooldown(integration) {
    this.timers.schedule(integration.id, Cooldown.endsAt(integration));
  }

  #startRetryCooldown(uuid, error) {
    if (error.status !== 429 || !Number.isInteger(error.retryAfter)) {
      return;
    }

    const cooldownUntil = Date.now() + (error.retryAfter * 1000);

    this.patchRow(uuid, { cooldownUntil });
    this.timers.schedule(uuid, cooldownUntil);
  }
}
