import AdminUserEditHelper from '../../../../../../../../assets/js/components/resources/admin/pages/helpers/AdminUserEditHelper.jsx';
import { itBehavesLikeAnAccountEditFormHelper } from '../../../../../../../support/accountEditFormHelperExamples.js';

describe('AdminUserEditHelper', () => {
  const { buildHandlers, buildState, renderPage } = itBehavesLikeAnAccountEditFormHelper({
    Helper: AdminUserEditHelper,
    heading: 'Edit User',
    successMessage: 'User updated.',
    submitError: 'Username already in use',
    idPrefix: 'admin-user-edit-',
    changeFields: ['username', 'email', 'newPassword', 'newPasswordConfirmation'],
  });

  describe('.render (current password)', () => {
    it('renders no current-password field, unlike MyAccount', () => {
      const page = renderPage(buildState(), buildHandlers());

      expect(page.contains('Current password')).withContext('current-password label').toBeFalse();
    });
  });

  describe('.render (password hint)', () => {
    it('renders the admin password hint', () => {
      const page = renderPage(buildState(), buildHandlers());

      expect(page.containsElement('p', 'Changing the password signs the user out of all sessions.'))
        .withContext('password hint').toBeTrue();
    });
  });
});
