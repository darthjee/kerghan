import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import FormErrors from '../../../../../../../../assets/js/components/resources/projects/pages/common/formErrors.js';

describe('FormErrors', () => {
  describe('.describeAll', () => {
    it('wraps each message as a described error', () => {
      expect(FormErrors.describeAll({ name: 'Name is required' })).toEqual({ name: { message: 'Name is required' } });
    });

    it('answers an empty map for no errors', () => {
      expect(FormErrors.describeAll({})).toEqual({});
    });
  });

  describe('.showRefusal', () => {
    let setFieldErrors;
    let setFormError;

    beforeEach(() => {
      setFieldErrors = jasmine.createSpy('setFieldErrors');
      setFormError = jasmine.createSpy('setFormError');
    });

    it('shows a field refusal on its field', () => {
      FormErrors.showRefusal(new ApiError(409, 'taken', 'PROJECT_NAME_TAKEN'), setFieldErrors, setFormError);

      expect(setFieldErrors).toHaveBeenCalledOnceWith({ name: { message: 'taken' } });
      expect(setFormError).not.toHaveBeenCalled();
    });

    it('shows any other refusal at form level', () => {
      FormErrors.showRefusal(new ApiError(422, 'limit', 'PROJECTS_LIMIT_REACHED'), setFieldErrors, setFormError);

      expect(setFormError).toHaveBeenCalledOnceWith({ message: 'limit' });
      expect(setFieldErrors).not.toHaveBeenCalled();
    });
  });
});
