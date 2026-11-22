# Routes: replace the placeholder
In `components/helpers/AppHelper.jsx`, map `issue-new` to `<IssueNew />`, `issue` to `<IssuePage />` and `issue-edit` to `<IssueEdit />`. Then delete `pages/ProjectsPlaceholder.jsx` and its spec. The `HashRouteResolver` order is unchanged.

Update the routes and AppHelper specs, so the seven routes resolve to their real screens and the literal segments still win (`…/issues/new` before `…/issues/:issueId`). Add the S3 case for an issue hash: `#/projects/<uuid>/issues/..%2Fadmin` shows "Issue not found" with no call.

## Files to Change
- `frontend/assets/js/components/helpers/AppHelper.jsx` — map the issue routes to the new pages
- `frontend/assets/js/components/resources/projects/pages/ProjectsPlaceholder.jsx` — delete
- `frontend/specs/assets/js/components/resources/projects/pages/ProjectsPlaceholderSpec.js` — delete (if present)
- `frontend/specs/assets/js/components/helpers/AppHelperSpec.js`, the routes spec — update
