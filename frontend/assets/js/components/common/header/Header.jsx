import { useMemo } from 'react';
import HeaderHelper from './helpers/HeaderHelper.jsx';
import HeaderController from './controllers/HeaderController.js';
import AuthSession from '../../../client/AuthSession.js';

/**
 * Application header, wrapping the current page's content. Shows a Login link when logged
 * out, or a Logout action when logged in — read directly from `AuthSession` at render time, no
 * context provider (consistent with this codebase's no-global-state style).
 *
 * @param {object} props - Component props.
 * @param {React.ReactNode} [props.children] - Current page content, rendered below the nav bar.
 * @returns {React.ReactElement} The rendered header and page content.
 */
export default function Header({ children }) {
  const controller = useMemo(() => new HeaderController(), []);

  const handleLogout = (event) => {
    event.preventDefault();
    return controller.handleLogout();
  };

  return (
    <>
      {HeaderHelper.render(AuthSession.isLoggedIn(), handleLogout)}
      {children}
    </>
  );
}
