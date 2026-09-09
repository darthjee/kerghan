import Navbar from 'react-bootstrap/cjs/Navbar.js';
import Nav from 'react-bootstrap/cjs/Nav.js';
import Container from 'react-bootstrap/cjs/Container.js';

/**
 * Rendering helper for the Header element.
 */
export default class HeaderHelper {
  /**
   * Render the application navigation bar.
   *
   * @param {boolean} isLoggedIn - Whether a session is currently active.
   * @param {boolean} isAdmin - Whether the current session belongs to an admin user.
   * @param {Function} onLogout - Click handler for the Logout link, used when logged in.
   * @param {Function} onOpenLogin - Called with a mode string (`'password'` / `'register'`) to
   *   open the login modal, used by the Login/Register links when logged out.
   * @returns {React.ReactElement} The rendered navigation bar.
   */
  static render(isLoggedIn, isAdmin, onLogout, onOpenLogin) {
    return (
      <Navbar bg="light" expand="md">
        <Container fluid>
          <Navbar.Brand href="#/">Kerghan</Navbar.Brand>
          <Navbar.Toggle aria-controls="header-navbar" />
          <Navbar.Collapse id="header-navbar">
            <Nav className="me-auto">
              {HeaderHelper.#renderAuthLinks(isLoggedIn, isAdmin, onLogout, onOpenLogin)}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    );
  }

  /**
   * Render the Login/Register/Recover links when logged out, or the Logout action (plus, for an
   * admin, the Admin Users link) when logged in.
   *
   * @param {boolean} isLoggedIn - Whether a session is currently active.
   * @param {boolean} isAdmin - Whether the current session belongs to an admin user.
   * @param {Function} onLogout - Click handler for the Logout link, used when logged in.
   * @param {Function} onOpenLogin - Called with a mode string to open the login modal, used by
   *   the Login/Register links.
   * @returns {React.ReactElement} The rendered auth nav links.
   */
  static #renderAuthLinks(isLoggedIn, isAdmin, onLogout, onOpenLogin) {
    if (isLoggedIn) {
      return (
        <>
          {HeaderHelper.#renderAdminLink(isAdmin)}
          <Nav.Link href="#" onClick={onLogout}>Logout</Nav.Link>
        </>
      );
    }

    return (
      <>
        {HeaderHelper.#renderLoginLink('password', 'Login', onOpenLogin)}
        {HeaderHelper.#renderLoginLink('register', 'Register', onOpenLogin)}
        <Nav.Link href="#/recover">Recover</Nav.Link>
      </>
    );
  }

  /**
   * Render a single link that opens the login modal in a given mode instead of navigating.
   *
   * @param {string} mode - Mode to open the modal in (`'password'` or `'register'`).
   * @param {string} label - Link text.
   * @param {Function} onOpenLogin - Called with `mode` when the link is clicked.
   * @returns {React.ReactElement} The rendered link.
   */
  static #renderLoginLink(mode, label, onOpenLogin) {
    const handleClick = (event) => {
      event.preventDefault();
      onOpenLogin(mode);
    };

    return <Nav.Link href="#" onClick={handleClick}>{label}</Nav.Link>;
  }

  /**
   * Render the Admin Users nav link, only shown to a logged-in admin.
   *
   * @param {boolean} isAdmin - Whether the current session belongs to an admin user.
   * @returns {React.ReactElement|null} The Admin Users link, or `null` for a non-admin.
   */
  static #renderAdminLink(isAdmin) {
    if (!isAdmin) {
      return null;
    }

    return <Nav.Link href="#/admin/users">Admin Users</Nav.Link>;
  }
}
