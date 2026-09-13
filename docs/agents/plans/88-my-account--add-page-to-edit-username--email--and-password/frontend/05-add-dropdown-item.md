# Add dropdown item

`HeaderHelper.jsx`'s `#renderMyAccountDropdown()` (lines 100-113) currently renders a single
`NavDropdown.Item href="#/account/authorization-requests"`. Add a second item:

```jsx
<NavDropdown.Item href="#/account/my-account">Account</NavDropdown.Item>
```

Update the method's JSDoc, which currently says it "Currently holds a single item" — it now holds
two.

## Files to Change
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx` — add the new dropdown
  item and update the docstring.
