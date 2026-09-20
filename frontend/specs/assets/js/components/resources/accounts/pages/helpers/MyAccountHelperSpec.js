import MyAccountHelper from '../../../../../../../../assets/js/components/resources/accounts/pages/helpers/MyAccountHelper.jsx';
import { itBehavesLikeAnAccountEditFormHelper } from '../../../../../../../support/accountEditFormHelperExamples.js';

describe('MyAccountHelper', () => {
  const { buildHandlers, buildState, renderHtml } = itBehavesLikeAnAccountEditFormHelper({
    Helper: MyAccountHelper,
    heading: 'My Account',
    successMessage: 'Account updated.',
    submitError: 'Invalid current password',
    idPrefix: 'my-account-',
    changeFields: [
      'username', 'email', 'currentPassword', 'newPassword', 'newPasswordConfirmation',
    ],
  });

  describe('.render (current password)', () => {
    it('renders the current-password field', () => {
      const html = renderHtml(buildState(), buildHandlers());

      expect(html).toContain('Current password');
      expect(html).toContain('id="my-account-currentPassword"');
    });

    it('wires the current-password change handler', () => {
      const handlers = buildHandlers();
      renderHtml(buildState(), handlers);

      expect(handlers.onChange).toHaveBeenCalledWith('currentPassword');
    });
  });
});
