# Approver "Keep signed in" badge

In `AuthorizationRequestsHelper.jsx`'s `renderRow`, render a badge in the Age cell after
`formatAge(request.createdAt)`, only when `request.keepSignedIn === true`:

```jsx
<span className="badge text-bg-info ms-2">Keep signed in</span>
```

This follows the existing badge style in `IntegrationsTableHelper.jsx`. The table keeps its
current columns and the Deny/Authorize actions are unchanged. Add `keepSignedIn: boolean` to the
row's JSDoc request shape.

Specs: the badge renders for a request with `keepSignedIn: true`, and does not render for `false`
or a missing value.

## Files to Change

- `frontend/assets/js/components/resources/accounts/pages/helpers/AuthorizationRequestsHelper.jsx`
  — render the conditional badge in the Age cell.
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/AuthorizationRequestsHelperSpec.js`
