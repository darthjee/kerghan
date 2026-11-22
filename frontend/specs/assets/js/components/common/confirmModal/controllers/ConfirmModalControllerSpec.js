import ConfirmModalController from '../../../../../../../assets/js/components/common/confirmModal/controllers/ConfirmModalController.js';

describe('ConfirmModalController', () => {
  describe('.isConfirmed', () => {
    it('allows confirming when no text must be typed', () => {
      expect(ConfirmModalController.isConfirmed(undefined, '')).toBe(true);
    });

    it('requires the typed text to equal the expected one', () => {
      expect(ConfirmModalController.isConfirmed('Kerghan', 'Kerghan')).toBe(true);
      expect(ConfirmModalController.isConfirmed('Kerghan', 'Kerg')).toBe(false);
      expect(ConfirmModalController.isConfirmed('Kerghan', '')).toBe(false);
    });

    it('trims the typed value (U9)', () => {
      expect(ConfirmModalController.isConfirmed('Kerghan', '  Kerghan \n')).toBe(true);
    });

    it('is case-sensitive (U9)', () => {
      expect(ConfirmModalController.isConfirmed('Kerghan', 'kerghan')).toBe(false);
    });

    it('does not trim the expected text', () => {
      expect(ConfirmModalController.isConfirmed(' Kerghan', 'Kerghan')).toBe(false);
    });
  });

  describe('#confirm', () => {
    let setPending;
    let setError;
    let controller;

    beforeEach(() => {
      setPending = jasmine.createSpy('setPending');
      setError = jasmine.createSpy('setError');
      controller = new ConfirmModalController(setPending, setError);
    });

    it('runs the action, flagging it in flight and clearing the error', async () => {
      const onConfirm = jasmine.createSpy('onConfirm').and.resolveTo();

      await controller.confirm(onConfirm, false);

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(setError).toHaveBeenCalledOnceWith(null);
      expect(setPending.calls.allArgs()).toEqual([[true], [false]]);
    });

    it('shows the rejection message inside the modal', async () => {
      await controller.confirm(() => Promise.reject(new Error('Boom')), false);

      expect(setError).toHaveBeenCalledWith('Boom');
      expect(setPending.calls.mostRecent().args).toEqual([false]);
    });

    it('falls back to a generic message for an error without one', async () => {
      await controller.confirm(() => Promise.reject(new Error('')), false);

      expect(setError).toHaveBeenCalledWith('Request failed');
    });

    it('ignores a second confirm while one is in flight (U2)', async () => {
      const onConfirm = jasmine.createSpy('onConfirm').and.resolveTo();

      await controller.confirm(onConfirm, true);

      expect(onConfirm).not.toHaveBeenCalled();
      expect(setPending).not.toHaveBeenCalled();
    });

    it('accepts a synchronous action', async () => {
      const onConfirm = jasmine.createSpy('onConfirm');

      await controller.confirm(onConfirm, false);

      expect(onConfirm).toHaveBeenCalled();
    });
  });
});
