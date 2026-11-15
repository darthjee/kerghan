# Issues and Projects — Security

Security rules of the feature; the detailed threat review is #490.
Part of the [Issues and Projects specs](../issues.md).

- Every read and write is scoped to the owning user.
- GitHub credentials stay in the backend: every GitHub call that uses a user's credential is made by the backend inside the Integrations module.
- No endpoint returns a credential or anything derived from it beyond the masked `secretHint`.
- The frontend never calls GitHub with a credential.
- Logs and job params carry only safe fields (ids).

## Open questions

- [ ] Is a write-capable credential required for outbound writes, and how is it requested? (#490)
- [ ] How is GitHub-sourced content handled and rendered? (#490)

## Required tests

- No credential appears in any response, job param or log.
