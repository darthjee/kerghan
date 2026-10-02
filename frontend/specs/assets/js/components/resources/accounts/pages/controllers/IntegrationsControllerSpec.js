import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import { CLOSED_ADD_FORM } from '../../../../../../../../assets/js/components/resources/accounts/pages/controllers/IntegrationsController.js';
import {
  CANARY, buildIntegration, useIntegrationsControllerHarness,
} from '../../../../../../../support/integrationsControllerHarness.js';

describe('IntegrationsController', () => {
  const context = useIntegrationsControllerHarness();
  let state;
  let setters;
  let client;
  const buildController = () => context.buildController();

  beforeEach(() => {
    ({ state, setters, client } = context);
  });

  describe('#load', () => {
    beforeEach(() => {
      client.listTypes.and.resolveTo({
        types: [
          { type: 'pat', flows: { credentialPaste: true, redirect: false } },
          { type: 'oauth_app', flows: { credentialPaste: false, redirect: true } },
          { type: 'github_app', flows: { credentialPaste: false, redirect: true } },
        ],
      });
    });

    it('stores the integrations and finishes loading', async () => {
      const integrations = [buildIntegration()];
      client.listMine.and.resolveTo({ integrations });

      await buildController().load();

      expect(state.integrations).toEqual(integrations);
      expect(state.loadState).toEqual({ loading: false, error: null });
    });

    it('stores an empty list', async () => {
      client.listMine.and.resolveTo({ integrations: [] });

      await buildController().load();

      expect(state.integrations).toEqual([]);
      expect(state.loadState).toEqual({ loading: false, error: null });
    });

    it('keeps only the enabled types the frontend implements', async () => {
      client.listMine.and.resolveTo({ integrations: [] });

      await buildController().load();

      expect(state.types.map(({ type }) => type)).toEqual(['pat', 'oauth_app']);
    });

    it('hides implemented types the server did not enable', async () => {
      client.listMine.and.resolveTo({ integrations: [] });
      client.listTypes.and.resolveTo({ types: [] });

      await buildController().load();

      expect(state.types).toEqual([]);
    });

    it('stores the load error on failure', async () => {
      client.listMine.and.rejectWith(new ApiError(502, 'Bad Gateway', 'GITHUB_UNAVAILABLE'));

      await buildController().load();

      expect(state.loadState).toEqual({
        loading: false, error: 'GitHub is unavailable right now. Try again later.',
      });
    });

    it('falls back to the API message for an unknown code', async () => {
      client.listMine.and.rejectWith(new ApiError(500, 'Internal error', 'INTERNAL'));

      await buildController().load();

      expect(state.loadState.error).toBe('Internal error');
    });

    it('does nothing when the session turned out to be expired', async () => {
      client.listMine.and.resolveTo(undefined);

      await buildController().load();

      Object.values(setters).forEach((setter) => expect(setter).not.toHaveBeenCalled());
    });
  });

  describe('#retry', () => {
    it('shows the loading state again and reloads', async () => {
      client.listMine.and.resolveTo({ integrations: [] });
      client.listTypes.and.resolveTo({ types: [] });
      const controller = buildController();

      const promise = controller.retry();

      expect(setters.setLoadState).toHaveBeenCalledWith({ loading: true, error: null });
      await promise;
      expect(client.listMine).toHaveBeenCalled();
      expect(state.loadState).toEqual({ loading: false, error: null });
    });
  });

  describe('#create', () => {
    const form = { type: 'pat', label: 'Work', credential: { token: CANARY } };

    beforeEach(() => {
      state.addForm = { ...CLOSED_ADD_FORM, open: true, ...form };
      state.integrations = [buildIntegration({ id: 'old' })];
    });

    it('posts the label, type and built credential', async () => {
      client.create.and.resolveTo(buildIntegration());

      await buildController().create(form);

      expect(client.create).toHaveBeenCalledWith({ label: 'Work', type: 'pat', credential: { token: CANARY } });
    });

    it('prepends the created integration and closes the form on success', async () => {
      const created = buildIntegration();
      client.create.and.resolveTo(created);

      await buildController().create(form);

      expect(state.integrations.map(({ id }) => id)).toEqual(['abc-123', 'old']);
      expect(state.addForm).toEqual(CLOSED_ADD_FORM);
    });

    it('clears the credential and stores a friendly error on failure', async () => {
      client.create.and.rejectWith(new ApiError(409, 'label taken', 'INTEGRATION_LABEL_TAKEN'));

      await buildController().create(form);

      expect(state.addForm.credential).toEqual({});
      expect(state.addForm.label).toBe('Work');
      expect(state.addForm.open).toBeTrue();
      expect(state.addForm.error).toBe('You already have an integration with this label. Choose another one.');
    });

    it('clears the credential before the request resolves', () => {
      client.create.and.returnValue(new Promise(() => undefined));

      buildController().create(form);

      expect(state.addForm.credential).toEqual({});
    });

    it('does nothing more when the session turned out to be expired', async () => {
      client.create.and.resolveTo(undefined);

      await buildController().create(form);

      expect(setters.setIntegrations).not.toHaveBeenCalled();
      expect(state.addForm.open).toBeTrue();
      expect(state.addForm.credential).toEqual({});
    });
  });

  describe('#rename', () => {
    beforeEach(() => {
      state.integrations = [buildIntegration(), buildIntegration({ id: 'other' })];
      state.rowState = new Map([['abc-123', { renaming: true, label: 'Home' }]]);
    });

    it('updates the row from the response and closes the rename form', async () => {
      client.rename.and.resolveTo(buildIntegration({ label: 'Home' }));

      await buildController().rename('abc-123', 'Home');

      expect(client.rename).toHaveBeenCalledWith('abc-123', 'Home');
      expect(state.integrations.map(({ label }) => label)).toEqual(['Home', 'Work']);
      expect(state.rowState.get('abc-123')).toEqual(jasmine.objectContaining({ renaming: false, error: null }));
    });

    it('stores a friendly row error on failure', async () => {
      client.rename.and.rejectWith(new ApiError(400, 'label must be shorter', 'VALIDATION_FAILED'));

      await buildController().rename('abc-123', 'Home');

      expect(state.rowState.get('abc-123')).toEqual(jasmine.objectContaining({
        renaming: true, error: 'Some fields are invalid: label must be shorter',
      }));
    });

    it('does nothing when the session turned out to be expired', async () => {
      client.rename.and.resolveTo(undefined);

      await buildController().rename('abc-123', 'Home');

      expect(setters.setIntegrations).not.toHaveBeenCalled();
      expect(setters.setRowState).not.toHaveBeenCalled();
    });
  });

  describe('#replaceCredential', () => {
    const integration = buildIntegration({ status: 'invalid' });

    beforeEach(() => {
      state.integrations = [integration];
      state.rowState = new Map([['abc-123', { replacing: true, credential: { token: CANARY } }]]);
    });

    it('posts the built credential and updates the row on success', async () => {
      client.replaceCredential.and.resolveTo(buildIntegration({ status: 'active' }));

      await buildController().replaceCredential(integration, { token: CANARY });

      expect(client.replaceCredential).toHaveBeenCalledWith('abc-123', { token: CANARY });
      expect(state.integrations[0].status).toBe('active');
      expect(state.rowState.get('abc-123')).toEqual({ replacing: false, credential: {}, error: null });
    });

    it('clears the credential and stores a friendly row error on failure', async () => {
      client.replaceCredential.and.rejectWith(new ApiError(423, 'locked', 'INTEGRATION_CREDENTIAL_LOCKED'));

      await buildController().replaceCredential(integration, { token: CANARY });

      expect(state.integrations[0].status).toBe('invalid');
      expect(state.rowState.get('abc-123')).toEqual({
        replacing: true, credential: {}, error: 'Too many failed attempts. Wait a while before trying again.',
      });
    });
  });

  describe('#remove', () => {
    beforeEach(() => {
      state.integrations = [buildIntegration(), buildIntegration({ id: 'other' })];
      state.rowState = new Map([['abc-123', { confirmingRemove: true }], ['other', {}]]);
    });

    it('drops the row and its state on success', async () => {
      client.remove.and.resolveTo({});

      await buildController().remove('abc-123');

      expect(client.remove).toHaveBeenCalledWith('abc-123');
      expect(state.integrations.map(({ id }) => id)).toEqual(['other']);
      expect(state.rowState.has('abc-123')).toBeFalse();
      expect(state.rowState.has('other')).toBeTrue();
    });

    it('keeps the row and stores the error on failure', async () => {
      client.remove.and.rejectWith(new ApiError(404, 'Not found', 'NOT_FOUND'));

      await buildController().remove('abc-123');

      expect(state.integrations.length).toBe(2);
      expect(state.rowState.get('abc-123').error).toBe('Not found');
    });
  });

  describe('#test', () => {
    beforeEach(() => {
      state.integrations = [buildIntegration()];
    });

    it('updates the row from the test outcome', async () => {
      client.test.and.resolveTo(buildIntegration({ status: 'invalid', statusReason: 'bad_credentials' }));

      await buildController().test('abc-123');

      expect(client.test).toHaveBeenCalledWith('abc-123');
      expect(state.integrations[0].status).toBe('invalid');
      expect(state.rowState.get('abc-123').error).toBeNull();
    });

    it('stores a friendly error for a transient failure', async () => {
      client.test.and.rejectWith(new ApiError(503, 'rate limited', 'GITHUB_RATE_LIMITED'));

      await buildController().test('abc-123');

      expect(state.rowState.get('abc-123')).toEqual({ error: 'GitHub rate limit reached. Try again later.' });
    });
  });

});
