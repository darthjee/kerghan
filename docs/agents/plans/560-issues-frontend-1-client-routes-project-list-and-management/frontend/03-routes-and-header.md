# Routes, page map and header link

**Routes.** Register the seven routes in `HashRouteResolver` ROUTES, literal segments before parameters:

```
['/projects/new', 'project-new'],
['/projects/:projectId/issues/new', 'issue-new'],
['/projects/:projectId/issues/:issueId/edit', 'issue-edit'],
['/projects/:projectId/issues/:issueId', 'issue'],
['/projects/:projectId/edit', 'project-edit'],
['/projects/:projectId', 'project'],
['/projects', 'projects'],
```

Place them before `['/', 'home']`.

**Page map.** Map the page keys in `components/helpers/AppHelper.jsx`. `issue-new`, `issue` and `issue-edit` point to a small `ProjectsPlaceholder` page ("Coming soon", with a link back to the project), which #561 and #562 replace.

**Header link.** Add a "Projects" link next to "Repositories" in the logged-in branch of `HeaderHelper.jsx`. The logged-out and pending views stay unchanged.

**Specs:**

- The seven routes resolve to their keys.
- `/projects/new` resolves to `project-new`, not `project`.
- `…/issues/new` resolves to `issue-new`, not `issue`.
- The query string is stripped before matching.
- The header shows the link for logged-in users only.

## Files to Change
- `frontend/assets/js/utils/routing/HashRouteResolver.js`: the seven routes
- `frontend/assets/js/components/helpers/AppHelper.jsx`: the page keys
- `frontend/assets/js/components/resources/projects/pages/ProjectsPlaceholder.jsx` (new)
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx`: the Projects link
- `frontend/specs/assets/js/utils/routing/` (the HashRouteResolver spec), `frontend/specs/assets/js/components/helpers/` (the AppHelper spec) and `frontend/specs/assets/js/components/common/header/`: the new cases
