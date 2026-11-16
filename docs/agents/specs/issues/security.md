# Issues and Projects — Security

Security rules of the feature; the detailed threat review is #490.
Part of the [Issues and Projects specs](../issues.md).

- Every read and write is scoped to the owning user.
- GitHub credentials stay in the backend: every GitHub call that uses a user's credential is made by the backend inside the Integrations module.
- No endpoint returns a credential or anything derived from it beyond the masked `secretHint`.
- The frontend never calls GitHub with a credential.
- Logs and job params carry only safe fields (ids).
- Another user's or a deleted project answers 404 ([projects.md](projects.md#deletion)).
- A project description is plain text and never rendered as markup ([projects.md](projects.md#fields)).
- Sharing guardrails ([projects.md](projects.md#room-for-sharing-members-and-roles)): one access check for every project and issue read or write, with no scattered `user_id` filters; issues derive access from their project; the owner's credentials do all GitHub work and link uniqueness stays per owner; the actor is not assumed to equal the owner.
- No table has a secret column; markers carry no payload.
- The link's `user_id` is for uniqueness only, never for authorization.
- Issue content of private repositories is stored unencrypted, like Repositories' private metadata ([model.md](model.md#performance-and-security)).

## Open questions

- [ ] Is a write-capable credential required for outbound writes, and how is it requested? (#490)
- [ ] Retention of the issue content of soft-deleted projects (their `issues` rows stay in v1). (#490)
- [ ] Encryption at rest of issue content, and per-user quotas on projects and issues. (#490)
- [ ] How is GitHub-sourced content handled and rendered? (#490)

## Required tests

- No credential appears in any response, job param or log.
- A project and its issues go through the single access check, and a non-owner gets 404 for both.
