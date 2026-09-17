import Header from '../common/header/Header.jsx';
import LoginModal from '../common/loginModal/LoginModal.jsx';
import ModalRedirect from '../common/ModalRedirect.jsx';
import Home from '../resources/home/pages/Home.jsx';
import ResetPasswordLanding from '../resources/accounts/pages/ResetPasswordLanding.jsx';
import AdminUsers from '../resources/admin/pages/AdminUsers.jsx';
import AdminUserEdit from '../resources/admin/pages/AdminUserEdit.jsx';
import AuthorizationRequests from '../resources/accounts/pages/AuthorizationRequests.jsx';
import MyAccount from '../resources/accounts/pages/MyAccount.jsx';

const PAGES = {
  register: <ModalRedirect mode="register" />,
  login: <ModalRedirect mode="password" />,
  'reset-password': <ResetPasswordLanding />,
  'admin-users': <AdminUsers />,
  'admin-user-edit': <AdminUserEdit />,
  'authorization-requests': <AuthorizationRequests />,
  'my-account': <MyAccount />,
  home: <Home />,
};

/**
 * Helper for application page rendering: maps a page key to its component.
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- static-methods-only
// utility/client class is this codebase's deliberate convention, matching
// components/common/header/helpers/HeaderHelper.jsx.
export default class AppHelper {
  /**
   * Render the app shell wrapping the page matching the given key, plus the route-independent
   * login modal.
   *
   * @param {string} page - Current page key.
   * @returns {React.ReactElement} The rendered app shell.
   */
  static render(page) {
    return (
      <>
        <Header>
          {PAGES[page] ?? PAGES.home}
        </Header>
        <LoginModal />
      </>
    );
  }
}
