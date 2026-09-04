import Header from '../common/header/Header.jsx';
import Home from '../resources/home/pages/Home.jsx';
import Register from '../resources/accounts/pages/Register.jsx';
import Login from '../resources/accounts/pages/Login.jsx';
import Recover from '../resources/accounts/pages/Recover.jsx';
import ResetPassword from '../resources/accounts/pages/ResetPassword.jsx';
import AdminUsers from '../resources/admin/pages/AdminUsers.jsx';

const PAGES = {
  register: <Register />,
  login: <Login />,
  recover: <Recover />,
  'reset-password': <ResetPassword />,
  'admin-users': <AdminUsers />,
  home: <Home />,
};

/**
 * Helper for application page rendering: maps a page key to its component.
 */
export default class AppHelper {
  /**
   * Render the app shell wrapping the page matching the given key.
   *
   * @param {string} page - Current page key.
   * @returns {React.ReactElement} The rendered app shell.
   */
  static render(page) {
    return (
      <Header>
        {PAGES[page] ?? PAGES.home}
      </Header>
    );
  }
}
