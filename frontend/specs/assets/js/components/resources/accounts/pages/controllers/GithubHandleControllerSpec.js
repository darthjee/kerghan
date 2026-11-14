import GithubHandleController, {
  FIELD_ERROR, INITIAL_STATE, LOAD_ERROR, REMOVED_MESSAGE, UPDATED_MESSAGE,
} from '../../../../../../../../assets/js/components/resources/accounts/pages/controllers/GithubHandleController.js';
import { flushMicrotasks } from '../../../../../../../support/flushMicrotasks.js';

describe('GithubHandleController', () => {
  let state;
  let client;
  let controller;

  beforeEach(() => {
    state = { ...INITIAL_STATE };
    client = jasmine.createSpyObj('client', ['getMyAccount', 'updateGithubHandle']);
    controller = new GithubHandleController((updater) => {
      state = updater(state);
    }, client);
  });

  describe('#load', () => {
    it('adopts the loaded handle', async () => {
      client.getMyAccount.and.resolveTo({ githubHandle: 'octocat' });

      await controller.load();

      expect(state.handle).toBe('octocat');
      expect(state.loading).toBe(false);
      expect(state.loadError).toBeNull();
    });

    it('leaves the input empty for a null handle', async () => {
      client.getMyAccount.and.resolveTo({ githubHandle: null });

      await controller.load();

      expect(state.handle).toBe('');
    });

    it('sets the load error on failure', async () => {
      client.getMyAccount.and.rejectWith(new Error('boom'));

      await controller.load();

      expect(state.loadError).toBe(LOAD_ERROR);
      expect(state.loading).toBe(false);
    });
  });

  describe('#save', () => {
    beforeEach(() => {
      client.updateGithubHandle.and.callFake(async (value) => ({ githubHandle: value && value.replace(/^@/, '').toLowerCase() }));
    });

    ['octocat', '@DarthJee', 'MixedCase-1'].forEach((value) => {
      it(`sends the trimmed value ${value}`, async () => {
        await controller.save(`  ${value}  `);

        expect(client.updateGithubHandle).toHaveBeenCalledOnceWith(value);
      });
    });

    ['', '   '].forEach((value) => {
      it(`sends null for "${value}" and reports removal`, async () => {
        await controller.save(value);

        expect(client.updateGithubHandle).toHaveBeenCalledOnceWith(null);
        expect(state.successMessage).toBe(REMOVED_MESSAGE);
        expect(state.handle).toBe('');
      });
    });

    ['--', '-a', 'a-', 'a'.repeat(40), '@@x', 'a$b'].forEach((value) => {
      it(`rejects ${value} inline without calling the client`, async () => {
        await controller.save(value);

        expect(client.updateGithubHandle).not.toHaveBeenCalled();
        expect(state.fieldError).toBe(FIELD_ERROR);
      });
    });

    it('adopts the normalised response and reports the update', async () => {
      await controller.save('@DarthJee');

      expect(state.handle).toBe('darthjee');
      expect(state.successMessage).toBe(UPDATED_MESSAGE);
      expect(state.saving).toBe(false);
      expect(state.fieldError).toBeNull();
    });

    it('clears previous messages before saving', async () => {
      state = { ...state, submitError: 'old', successMessage: 'old', fieldError: 'old' };
      client.updateGithubHandle.and.returnValue(new Promise(() => undefined));

      controller.save('octocat');
      await flushMicrotasks();

      expect(state.submitError).toBeNull();
      expect(state.successMessage).toBeNull();
      expect(state.fieldError).toBeNull();
      expect(state.saving).toBe(true);
    });

    it('sets submitError from the server error', async () => {
      client.updateGithubHandle.and.rejectWith(new Error('Handle taken'));

      await controller.save('octocat');

      expect(state.submitError).toBe('Handle taken');
      expect(state.saving).toBe(false);
    });

    it('never sends a currentPassword', async () => {
      await controller.save('octocat');

      expect(client.updateGithubHandle.calls.mostRecent().args).toEqual(['octocat']);
    });
  });
});
