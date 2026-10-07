# Header and one-time migration wiring

- `Header.jsx` keeps `useState(AuthSession.isLoggedIn())` (now backed by the hint cookie). Update its JSDoc.
- Run the migration once at app start, before the Header's mount-time `checkStatus`. In the Header's mount effect (or the app entry point, whichever already runs first), call `AuthSession.takeLegacyToken()`. When it returns a token, `await AccountsClient.migrateLegacyToken(token)`, then refresh the login state (call `checkStatus()`, or re-read `AuthSession.isLoggedIn()`). Add a `TODO(#324-migration)` comment so the whole branch can be deleted later together with the backend fallback.

## Files to Change
- `frontend/assets/js/components/common/header/Header.jsx` — migration before the status check; JSDoc
- `frontend/assets/js/components/common/header/controllers/HeaderController.js` — optionally host the `migrateIfNeeded()` method so `Header.jsx` stays thin
