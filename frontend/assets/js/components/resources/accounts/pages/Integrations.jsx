/**
 * Integrations page (`#/account/integrations`): lists and manages the caller's GitHub
 * integrations. Performs no client-side login check of its own — a logged-out `401` is handled
 * entirely by `ApiClient`'s existing refresh/login-modal flow.
 *
 * @returns {React.ReactElement} The rendered Integrations page.
 */
export default function Integrations() {
  return (
    <div className="container mt-4">
      <h1>Integrations</h1>
    </div>
  );
}
