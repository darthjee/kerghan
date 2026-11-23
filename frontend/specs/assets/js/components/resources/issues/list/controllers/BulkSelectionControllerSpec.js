import BulkSelectionController, {
  buildNotice, INITIAL_BULK,
} from '../../../../../../../../assets/js/components/resources/issues/list/controllers/BulkSelectionController.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import { PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';

describe('BulkSelectionController', () => {
  let state;
  let client;
  let list;
  let controller;

  const result = (overrides) => ({
    state: 'closed', changed: ['a', 'b'], unchanged: [], notFound: [], ...overrides,
  });

  beforeEach(() => {
    jasmine.clock().install();
    state = { ...INITIAL_BULK };
    client = jasmine.createSpyObj('client', ['bulkState']);
    client.bulkState.and.resolveTo(result());
    list = { reload: jasmine.createSpy('reload').and.resolveTo(undefined) };
    controller = new BulkSelectionController(
      { setBulk: (value) => { state = value; } }, PROJECT_ID, list, client,
    );
  });

  afterEach(() => {
    controller.dispose();
    jasmine.clock().uninstall();
  });

  describe('selection', () => {
    it('toggles one id on and off', () => {
      controller.toggle('a');
      controller.toggle('b');
      expect(state.selected).toEqual(['a', 'b']);

      controller.toggle('a');
      expect(state.selected).toEqual(['b']);
    });

    it('selects every row of the page with toggleAll', () => {
      controller.toggle('a');

      controller.toggleAll(['a', 'b', 'c']);

      expect(state.selected).toEqual(['a', 'b', 'c']);
    });

    it('unchecks everything with toggleAll when all are checked', () => {
      controller.toggleAll(['a', 'b']);

      controller.toggleAll(['a', 'b']);

      expect(state.selected).toEqual([]);
    });

    it('does nothing selecting an empty page', () => {
      controller.toggleAll([]);

      expect(state.selected).toEqual([]);
    });

    it('clears the selection, the notice and the error', () => {
      controller.toggle('a');

      controller.clear();

      expect(state).toEqual(jasmine.objectContaining({ selected: [], notice: null, error: null }));
    });
  });

  describe('#apply', () => {
    beforeEach(() => {
      controller.toggleAll(['a', 'b']);
    });

    it('sends the selection and the state', async () => {
      await controller.apply('closed');

      expect(client.bulkState).toHaveBeenCalledOnceWith(PROJECT_ID, { issueIds: ['a', 'b'], state: 'closed' });
    });

    it('is in flight meanwhile', async () => {
      let resolve;

      client.bulkState.and.returnValue(new Promise((done) => { resolve = done; }));
      const applying = controller.apply('closed');

      expect(state.inFlight).toBe(true);
      resolve(result());
      await applying;
      expect(state.inFlight).toBe(false);
    });

    it('ignores a second call while one is in flight', async () => {
      let resolve;

      client.bulkState.and.returnValue(new Promise((done) => { resolve = done; }));
      const applying = controller.apply('closed');

      await controller.apply('open');
      resolve(result());
      await applying;

      expect(client.bulkState).toHaveBeenCalledTimes(1);
    });

    it('ignores the call with nothing selected', async () => {
      controller.clear();

      await controller.apply('closed');

      expect(client.bulkState).not.toHaveBeenCalled();
    });

    it('shows the notice, clears the selection and re-reads the list once', async () => {
      await controller.apply('closed');

      expect(state.notice).toBe('Closed 2 issues.');
      expect(state.selected).toEqual([]);
      expect(list.reload).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the session expired', async () => {
      client.bulkState.and.resolveTo(undefined);

      await controller.apply('closed');

      expect(state.selected).toEqual(['a', 'b']);
      expect(state.inFlight).toBe(false);
      expect(list.reload).not.toHaveBeenCalled();
    });

    it('keeps the selection and shows the described message on another error', async () => {
      client.bulkState.and.rejectWith(new ApiError(400, 'Bad ids', 'VALIDATION_FAILED', ['x']));

      await controller.apply('closed');

      expect(state.selected).toEqual(['a', 'b']);
      expect(state.error).toEqual(jasmine.objectContaining({ message: 'Bad ids', details: ['x'] }));
      expect(state.inFlight).toBe(false);
      expect(list.reload).not.toHaveBeenCalled();
    });

    it('falls through to the list re-read on a 404', async () => {
      client.bulkState.and.rejectWith(new ApiError(404, 'Gone', 'PROJECT_NOT_FOUND'));

      await controller.apply('closed');

      expect(list.reload).toHaveBeenCalledTimes(1);
      expect(state.error).toBeNull();
    });
  });

  describe('a 429 ISSUE_EDIT_RATE_LIMITED', () => {
    beforeEach(async () => {
      controller.toggleAll(['a', 'b']);
      client.bulkState.and.rejectWith(new ApiError(429, 'Slow down', 'ISSUE_EDIT_RATE_LIMITED', undefined, 3, 3));
      await controller.apply('closed');
    });

    it('keeps the selection and starts the countdown, without re-reading', () => {
      expect(state.selected).toEqual(['a', 'b']);
      expect(state.error.message).toBe('Slow down');
      expect(state.countdown).toEqual({ active: true, secondsLeft: 3, label: 'Try again in 3 s' });
      expect(list.reload).not.toHaveBeenCalled();
    });

    it('counts down, and resubmits nothing', async () => {
      jasmine.clock().tick(1000);
      expect(state.countdown.label).toBe('Try again in 2 s');

      await controller.apply('closed');
      expect(client.bulkState).toHaveBeenCalledTimes(1);

      jasmine.clock().tick(2000);
      expect(state.countdown.active).toBe(false);
      expect(client.bulkState).toHaveBeenCalledTimes(1);
    });

    it('allows applying again once the countdown ended', async () => {
      jasmine.clock().tick(3000);
      client.bulkState.and.resolveTo(result());

      await controller.apply('closed');

      expect(client.bulkState).toHaveBeenCalledTimes(2);
    });

    it('stops the countdown on dispose', () => {
      controller.dispose();
      jasmine.clock().tick(1000);

      expect(state.countdown.secondsLeft).toBe(3);
    });
  });

  describe('buildNotice', () => {
    it('reports the closed count', () => {
      expect(buildNotice(result({ changed: ['a', 'b', 'c'] }))).toBe('Closed 3 issues.');
    });

    it('reports the reopened count', () => {
      expect(buildNotice(result({ state: 'open' }))).toBe('Reopened 2 issues.');
    });

    it('adds the already-closed part', () => {
      expect(buildNotice(result({ unchanged: ['c'] }))).toBe('Closed 2 issues. 1 were already closed.');
    });

    it('adds the already-open part when reopening', () => {
      expect(buildNotice(result({ state: 'open', unchanged: ['c'] }))).toBe('Reopened 2 issues. 1 were already open.');
    });

    it('adds the no-longer-found part', () => {
      expect(buildNotice(result({ notFound: ['c'] }))).toBe('Closed 2 issues. 1 were no longer found.');
    });

    it('adds every part together', () => {
      expect(buildNotice(result({ changed: [], unchanged: ['c'], notFound: ['d'] })))
        .toBe('Closed 0 issues. 1 were already closed. 1 were no longer found.');
    });
  });
});
