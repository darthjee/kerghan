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
- A revoked, invalid, missing or read-only credential never retries and never leaks: the job stops, the marker is kept and the link shows a credential reason (E19 to E21 of [edge-cases.md](edge-cases.md)). Only a `401` invalidates an integration.
- A not-found answer on link creation never reveals more than the owner's credential can read, the owner's credentials do the read, and no GitHub content reaches logs or job params ([github-link.md](github-link.md#compatibility-performance-and-security)).
- A `404` never discards a marker without a successful repository read with the same credential (E22).
- Jobs make no GitHub call for a user who is not `approved` (E24).
- No table has a secret column; markers carry no payload.
- The link's `user_id` is for uniqueness only, never for authorization.
- Issue content of private repositories is stored unencrypted, like Repositories' private metadata ([model.md](model.md#performance-and-security)).

## Open questions

- [ ] How is a write-capable credential requested (the outcome without one is fixed in E19 to E21 of [edge-cases.md](edge-cases.md))? (#490)
- [ ] Retention of the issue content of soft-deleted projects (their `issues` rows stay in v1). (#490)
- [ ] Encryption at rest of issue content, and per-user quotas on projects and issues. (#490)
- [ ] How is GitHub-sourced content handled and rendered? (#490)

## Required tests

- No credential appears in any response, job param or log (the canary sweep of [testing.md](testing.md#security-verification)).
- A revoked, missing or read-only credential stops the job without retry and keeps the marker (E19 to E21); a `404` with a failing issues probe discards no marker (E22); a non-approved user's job makes no call (E24).
- A project and its issues go through the single access check, and a non-owner gets 404 for both (the route access matrix and the two-user baseline of [testing.md](testing.md#security-verification)).
- No `fetch`, `secret_iv` or `NOW(` in the Issues sources, no Integrations or Auth mapping, and no secret or payload column `(static)`.
- A not-found answer on link creation reveals nothing beyond what the owner's credential can read, and the read uses the owner's credentials (E57, E59).
- A project description is rendered as text, never as markup (frontend static spec).
