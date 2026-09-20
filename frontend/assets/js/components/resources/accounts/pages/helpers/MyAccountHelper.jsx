import AccountEditFormHelper from '../../../../common/forms/helpers/AccountEditFormHelper.jsx';

const LEADING_PASSWORD_FIELDS = [
  ['currentPassword', 'password', 'Current password'],
];

/**
 * Rendering helper for the "My account" page.
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- static-methods-only
// utility/client class is this codebase's deliberate convention, matching
// components/resources/accounts/pages/helpers/AuthorizationRequestsHelper.jsx.
export default class MyAccountHelper {
  /**
   * Render the My Account page: editable username/email fields, the required current-password
   * confirmation, a change-password section, a save action, and inline error/success display.
   * The shared markup is rendered by {@link AccountEditFormHelper}.
   *
   * @param {{username: string, email: string, currentPassword: string, newPassword: string,
   *   newPasswordConfirmation: string, fieldErrors: object, submitError: (string|null),
   *   success: boolean}} state - Page state.
   * @param {{onSubmit: Function, onChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The rendered My Account page.
   */
  static render(state, handlers) {
    return AccountEditFormHelper.render(state, handlers, {
      heading: 'My Account',
      successMessage: 'Account updated.',
      idPrefix: 'my-account-',
      leadingPasswordFields: LEADING_PASSWORD_FIELDS,
    });
  }
}
