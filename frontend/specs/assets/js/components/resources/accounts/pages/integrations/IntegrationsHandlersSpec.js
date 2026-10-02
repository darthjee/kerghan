import IntegrationsHandlers from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/IntegrationsHandlers.js';
import { CLOSED_ADD_FORM } from '../../../../../../../../assets/js/components/resources/accounts/pages/controllers/IntegrationsController.js';

describe('IntegrationsHandlers', () => {
  let controller;
  const integration = { id: 'abc', type: 'pat', label: 'Work' };
  const addForm = {
    ...CLOSED_ADD_FORM, open: true, type: 'pat', label: 'Work', credential: { token: 'x' },
  };
  const rowState = new Map([['abc', { label: 'Home', credential: { token: 'y' } }]]);
  const event = (value) => ({ target: { value }, preventDefault: jasmine.createSpy('preventDefault') });

  const build = (state = { addForm, rowState }) => IntegrationsHandlers.build(controller, state);

  beforeEach(() => {
    controller = jasmine.createSpyObj('controller', [
      'retry', 'setAddForm', 'patchAddForm', 'create', 'patchRow', 'rename',
      'replaceCredential', 'remove', 'test',
    ]);
  });

  it('retries the load', () => {
    build().onRetry();

    expect(controller.retry).toHaveBeenCalled();
  });

  describe('add form', () => {
    it('opens a fresh form', () => {
      build().onOpenAdd();

      expect(controller.setAddForm).toHaveBeenCalledWith({ ...CLOSED_ADD_FORM, open: true });
    });

    it('closes the form', () => {
      build().onCancelAdd();

      expect(controller.setAddForm).toHaveBeenCalledWith(CLOSED_ADD_FORM);
    });

    it('picks a type, resetting the credential', () => {
      build().onPickType('pat')();

      expect(controller.patchAddForm).toHaveBeenCalledWith({ type: 'pat', credential: {} });
    });

    it('changes the label', () => {
      build().onAddLabelChange(event('Home'));

      expect(controller.patchAddForm).toHaveBeenCalledWith({ label: 'Home' });
    });

    it('changes a credential field, keeping the others', () => {
      build().onAddCredentialChange('other')(event('z'));

      expect(controller.patchAddForm).toHaveBeenCalledWith({ credential: { token: 'x', other: 'z' } });
    });

    it('submits the form, preventing navigation', () => {
      const submit = event();

      build().onSubmitAdd(submit);

      expect(submit.preventDefault).toHaveBeenCalled();
      expect(controller.create).toHaveBeenCalledWith(addForm);
    });
  });

  describe('rename', () => {
    it('starts renaming with the current label', () => {
      build().onStartRename(integration)();

      expect(controller.patchRow).toHaveBeenCalledWith('abc', { renaming: true, label: 'Work', error: null });
    });

    it('changes the label', () => {
      build().onRenameChange('abc')(event('New'));

      expect(controller.patchRow).toHaveBeenCalledWith('abc', { label: 'New' });
    });

    it('cancels', () => {
      build().onCancelRename('abc')();

      expect(controller.patchRow).toHaveBeenCalledWith('abc', { renaming: false });
    });

    it('submits the row label', () => {
      const submit = event();

      build().onSubmitRename('abc')(submit);

      expect(submit.preventDefault).toHaveBeenCalled();
      expect(controller.rename).toHaveBeenCalledWith('abc', 'Home');
    });

    it('submits an empty label for a row without state', () => {
      build().onSubmitRename('missing')(event());

      expect(controller.rename).toHaveBeenCalledWith('missing', '');
    });
  });

  describe('replace credential', () => {
    it('starts replacing with an empty credential', () => {
      build().onStartReplace('abc')();

      expect(controller.patchRow).toHaveBeenCalledWith('abc', { replacing: true, credential: {}, error: null });
    });

    it('changes a credential field, keeping the others', () => {
      build().onReplaceCredentialChange('abc', 'token')(event('new'));

      expect(controller.patchRow).toHaveBeenCalledWith('abc', { credential: { token: 'new' } });
    });

    it('cancels, clearing the credential', () => {
      build().onCancelReplace('abc')();

      expect(controller.patchRow).toHaveBeenCalledWith('abc', { replacing: false, credential: {} });
    });

    it('submits the row credential', () => {
      const submit = event();

      build().onSubmitReplace(integration)(submit);

      expect(submit.preventDefault).toHaveBeenCalled();
      expect(controller.replaceCredential).toHaveBeenCalledWith(integration, { token: 'y' });
    });

    it('submits an empty credential for a row without state', () => {
      build({ addForm, rowState: new Map() }).onSubmitReplace(integration)(event());

      expect(controller.replaceCredential).toHaveBeenCalledWith(integration, {});
    });
  });

  describe('remove', () => {
    it('asks for confirmation', () => {
      build().onAskRemove('abc')();

      expect(controller.patchRow).toHaveBeenCalledWith('abc', { confirmingRemove: true, error: null });
    });

    it('cancels the confirmation', () => {
      build().onCancelRemove('abc')();

      expect(controller.patchRow).toHaveBeenCalledWith('abc', { confirmingRemove: false });
    });

    it('removes once confirmed', () => {
      build().onConfirmRemove('abc')();

      expect(controller.remove).toHaveBeenCalledWith('abc');
    });
  });

  it('tests a connection', () => {
    build().onTest('abc')();

    expect(controller.test).toHaveBeenCalledWith('abc');
  });
});
