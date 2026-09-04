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
   * @returns {React.ReactElement} The rendered navigation bar.
   */
  static render(isLoggedIn, isAdmin, onLogout) {
    return (
      <Navbar bg="light" expand="md">
        <Container fluid>
          <Navbar.Brand href="#/">Kerghan</Navbar.Brand>
          <Navbar.Toggle aria-controls="header-navbar" />
          <Navbar.Collapse id="header-navbar">
            <Nav className="me-auto">
              {HeaderHelper.#renderAuthLinks(isLoggedIn, isAdmin, onLogout)}
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
   * @returns {React.ReactElement} The rendered auth nav links.
   */
  static #renderAuthLinks(isLoggedIn, isAdmin, onLogout) {
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
        <Nav.Link href="#/login">Login</Nav.Link>
        <Nav.Link href="#/register">Register</Nav.Link>
        <Nav.Link href="#/recover">Recover</Nav.Link>
      </>
    );
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
