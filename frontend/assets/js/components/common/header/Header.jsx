import HeaderHelper from './helpers/HeaderHelper.jsx';

/**
 * Application header, wrapping the current page's content. Always shows the same
 * navigation regardless of auth state (auth-awareness is explicitly out of scope for this
 * issue).
 *
 * @param {object} props - Component props.
 * @param {React.ReactNode} [props.children] - Current page content, rendered below the nav bar.
 * @returns {React.ReactElement} The rendered header and page content.
 */
export default function Header({ children }) {
  return (
    <>
      {HeaderHelper.render()}
      {children}
    </>
  );
}
