# Add the Edit link to the Admin Users table

In `AdminUsersHelper.jsx`'s `#renderRow`, add an "Edit" link alongside the existing "Generate
link"/"Send email" buttons:

```jsx
<a
  href={`#/admin/users/${user.id}/edit`}
  className="btn btn-sm btn-secondary me-2"
>
  Edit
</a>
```

Plain hash-href navigation — no controller method or handler needed, since this only navigates
(the existing "Generate link"/"Send email" buttons trigger async calls and need handlers; this
doesn't).

## Files to Change

- `frontend/assets/js/components/resources/admin/pages/helpers/AdminUsersHelper.jsx` — add the
  "Edit" link inside `#renderRow`'s actions cell.
