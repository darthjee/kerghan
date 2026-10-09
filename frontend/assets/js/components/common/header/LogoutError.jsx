import Alert from 'react-bootstrap/cjs/Alert.js';

/**
 * Error banner shown below the navigation bar when signing out failed, so the user knows the
 * session is still active and can retry.
 *
 * @description Renders nothing when there is no error message.
 * @param {object} props - Component props.
 * @param {string|null} [props.message] - The error message to show, or `null` for none.
 * @returns {React.ReactElement|null} The rendered error banner, or `null` when there is no error.
 */
export default function LogoutError({ message }) {
  if (!message) {
    return null;
  }

  return <Alert variant="danger" className="m-2">{message}</Alert>;
}
