import ResetPasswordController from '../../../../../../../../assets/js/components/resources/accounts/pages/controllers/ResetPasswordController.js';

describe('ResetPasswordController', () => {
  const validFields = { password: 'secret', passwordConfirmation: 'secret' };

  describe('#validate', () => {
    it('returns no errors for a valid form', () => {
      const controller = new ResetPasswordController();

      expect(controller.validate(validFields)).toEqual({});
    });

    it('flags a missing password', () => {
      const controller = new ResetPasswordController();

      expect(controller.validate({ ...validFields, password: '' }).password).toBeDefined();
    });

    it('flags a missing password confirmation', () => {
      const controller = new ResetPasswordController();

      expect(
        controller.validate({ ...validFields, passwordConfirmation: '' }).passwordConfirmation,
      ).toBeDefined();
    });

    it('flags a mismatched password confirmation', () => {
      const controller = new ResetPasswordController();

      expect(
        controller.validate({ ...validFields, passwordConfirmation: 'other' }).passwordConfirmation,
      ).toBeDefined();
    });
  });
});
