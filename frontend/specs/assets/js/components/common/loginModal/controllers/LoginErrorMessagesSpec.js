import LoginErrorMessages, {
  USER_DENIED_MESSAGE,
} from '../../../../../../../assets/js/components/common/loginModal/controllers/LoginErrorMessages.js';
import ApiError from '../../../../../../../assets/js/client/ApiError.js';

describe('LoginErrorMessages', () => {
  describe('.forLogin', () => {
    it('maps a 403 USER_DENIED to the denied message', () => {
      const error = new ApiError(403, 'This account has been denied access', 'USER_DENIED');

      expect(LoginErrorMessages.forLogin(error)).toBe(USER_DENIED_MESSAGE);
    });

    it("keeps a 401's own message", () => {
      const error = new ApiError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');

      expect(LoginErrorMessages.forLogin(error)).toBe('Invalid credentials');
    });

    it('keeps the message of an error without a code', () => {
      expect(LoginErrorMessages.forLogin(new Error('network down'))).toBe('network down');
    });
  });
});
