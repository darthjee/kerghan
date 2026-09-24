# Convert AuthorizationRequestsSpec
Convert the "passes the default state to the helper" case (2 `xss/no-mixed-html` findings), mirroring `AdminUsersSpec.js`.

- Drop the `react-dom/server` import; import `renderedOutput` from `../../../../../../support/renderedOutput.js`.
- `const page = renderedOutput(React.createElement(AuthorizationRequests));` then `expect(page.contains('authorization-requests')).toBeTrue();`, keeping the `toHaveBeenCalledWith` assertion unchanged.
- Leave the `renderCapturingHandlers`-based cases alone.

## Files to Change
- `frontend/specs/assets/js/components/resources/accounts/pages/AuthorizationRequestsSpec.js`: switch to `renderedOutput`.
