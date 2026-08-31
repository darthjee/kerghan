import { useMemo, useState } from 'react';
import HeaderHelper from './helpers/HeaderHelper.jsx';
import HeaderController from './controllers/HeaderController.js';
import useAuthEffect from './hooks/useAuthEffect.js';
import AuthSession from '../../../client/AuthSession.js';

/**
 * Application header, wrapping the current page's content. Shows a Login link when logged
 * out, or a Logout action when logged in — driven by state kept in sync with the shared
 * `AuthEvents` bus (via {@link useAuthEffect}), so it reacts to any auth-state change
 * independently of a page redirect, not just read from `AuthSession` at render time.
 *
 * @param {object} props - Component props.
 * @param {React.ReactNode} [props.children] - Current page content, rendered below the nav bar.
 * @returns {React.ReactElement} The rendered header and page content.
 */
export default function Header({ children }) {
  const controller = useMemo(() => new HeaderController(), []);
  const [loggedIn, setLoggedIn] = useState(AuthSession.isLoggedIn());

  useAuthEffect(controller, setLoggedIn);

  const handleLogout = (event) => {
    event.preventDefault();
    return controller.handleLogout();
  };

  return (
    <>
      {HeaderHelper.render(loggedIn, handleLogout)}
      {children}
    </>
  );
}
