# Repositories — Security

Security and abuse rules for the Repositories feature. Part of the
[Repositories specs](README.md).

## Credentials stay in the backend

**Every GitHub call that uses a user's credential is made by the backend, and no endpoint ever
returns a credential or a value derived from it beyond the masked `secretHint`.**

- In this feature, every GitHub call happens in the backend, authenticated or not; the frontend
  never calls GitHub for the listing.
- Inside the backend, credentials stay **inside the Integrations module**
  ([integrations.md](integrations.md#exported-service)).
- This rule is cross-cutting: #452 promotes it to `docs/agents/architecture/security.md` as its
  own section (alongside "CSRF"), linked from `docs/agents/modules/integrations.md`.

> **Open — settled by #448:** the guarantees of the Integrations exported interface.

## User scoping

- Every query is filtered by the session's user id.
- Another user's repository answers `404` like a missing one.
- Admins have no access to anyone's repositories (same rule as integrations).
- Every endpoint requires `JwtGuard` and sends `X-Skip-Cache` ([api.md](api.md#every-route)).

## Add verification

Add is verified with GitHub ([api.md](api.md#add)), so a user cannot add a repository, or learn
its metadata, by guessing a GitHub repository id.

## Private metadata lifecycle

Private metadata is kept only while a source can still see it, except for added repos, kept as
unavailable ([model.md](model.md#private-metadata-lifecycle)).

## GitHub handle

- Validated against GitHub's username format (letters, digits, single hyphens, at most 39
  characters) before it is stored.
- URL-encoded when used, so it cannot alter the GitHub API path.

> **Open — settled by #449:** the exact validation and normalisation, and the narrowing of the
> default-user edit block to the managed fields.

## Fixed GitHub base URL

The backend only ever calls `https://api.github.com`. No user input chooses the host or a path
outside the endpoints this feature uses, so there is no SSRF surface.

## CSRF

The state-changing routes (Refresh, Add) are `POST`, covered by `OriginGuard`
([architecture/security.md](../../architecture/security.md#csrf)).

## Errors and logging

- GitHub error bodies are never echoed to the client; source errors map to a fixed set of
  statuses and messages.
- Credentials never appear in logs or error responses.

> **Open — settled by #446:** the exact error codes and messages.

## Abuse and performance

- One sync per user at a time, a Refresh cooldown, a per-source page cap, and an early stop of
  the unauthenticated source on a low rate-limit budget ([sync.md](sync.md)).
- Timeouts and a parallelism bound on GitHub calls.

## Required tests

Tests for the open points above are added by the issue that settles them.

- No response of the feature contains a credential or a value derived from one.
- The Repositories module never handles a decrypted credential.
- Every route is user-scoped: another user's repository answers `404`; admins get no access.
- Add with a GitHub repository id the user cannot see answers `404` and writes nothing.
- Deleting an integration purges not-added repos only it could see.
- An invalid handle is rejected before storage; a stored handle is URL-encoded in the GitHub
  path.
- Every GitHub call targets `https://api.github.com`.
- Refresh and Add from a foreign origin are rejected by `OriginGuard`.
- A GitHub error body is never returned verbatim; no credential is logged.
- A second concurrent sync and a Refresh inside the cooldown are refused.
