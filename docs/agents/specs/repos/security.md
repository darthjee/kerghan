# Repositories — Security

Security and abuse rules for the Repositories feature. Part of the
[Repositories specs](README.md).

## Credentials stay in the backend

**Every GitHub call that uses a user's credential is made by the backend, and no endpoint ever
returns credential material (secrets, tokens, GitHub App installation tokens) or anything
computed from it, beyond the masked `secretHint` of the Integrations routes.** Data fetched
*with* a credential (the private-repo listing) is not credential material.

- In this feature, every GitHub call happens in the backend, authenticated or not; the frontend
  never calls GitHub for the listing.
- Inside the backend, credentials stay **inside the Integrations module**
  ([integrations.md](integrations.md#exported-service)).
- A minted GitHub App installation token is a credential too: if cached, it stays inside the
  Integrations module, in memory or in the integration's own encrypted record. Any other
  persistence needs its own product decision (`CLAUDE.md`, #295).
- Repo responses carry no integration field beyond its `uuid` and label
  ([api.md](api.md#access)).
- This rule is cross-cutting: #452 promotes it to `docs/agents/architecture/security.md` as its
  own section (alongside "CSRF"), linked from `docs/agents/modules/integrations.md`.

> **Open — settled by #448:** the guarantees of the Integrations exported interface.

## User scoping

- Every query is filtered by the session's user id **in the query itself** (`… AND user_id = ?`),
  never by loading a row and comparing afterwards.
- Another user's repository answers `404` identical to a missing one: same status, code and
  message.
- No response, error code or message reveals that another user holds or added the same GitHub
  repository.
- Add looks up the caller's own row before any GitHub call ([api.md](api.md#add)).
- No response exposes `user_id` or an internal `integrations.id` ([api.md](api.md#access)).
- Admins have no access to anyone's repositories (same rule as integrations), and the existing
  admin endpoints (`/admin/users/*`) carry no repository-derived field (counts, flags, names,
  sync state).
- Every endpoint requires `JwtGuard` and sends `X-Skip-Cache` ([api.md](api.md#every-route)).

## Add verification

Add only accepts a repository already in the caller's own listing, and is verified with GitHub
([api.md](api.md#add)), so a user cannot add a repository, or learn its metadata, by guessing a
GitHub repository id or an `owner/name`.

- The [repo ref](api.md#repo-ref) is `{ githubId }` or `{ fullName }`; a `fullName` resolves
  only among the caller's own rows, so it cannot reach a repo outside the listing.
- Check order: per-user rate limit → own-rows lookup → GitHub re-check. The rate limit comes
  first, so every attempt counts and probing is bounded.
- Every `404` carries the same code and message (`Repository not found`), whether the ref is
  absent, held only by another user, or denied by GitHub.
- The rate limit is **30 Adds per 60 s** per user by default, configurable
  ([api.md](api.md#add-rate-limit)); the unauthenticated re-check honours the low-budget
  threshold.

## Private metadata lifecycle

Private metadata is kept only while a source can still see it, except for added repos, kept as
unavailable ([model.md](model.md#private-metadata-lifecycle)). The handle source keeps only
public repos, so private metadata is always tied to the integration that granted it
([sync.md](sync.md#sources)).

## GitHub handle

- Validated against GitHub's username format (letters, digits, single hyphens, at most 39
  characters) before it is stored.
- URL-encoded when used, so it cannot alter the GitHub API path.

> **Open — settled by #449:** the exact validation and normalisation, the narrowing of the
> default-user edit block to the managed fields, and whether admin endpoints show or edit the
> handle.

## Fixed GitHub base URL

The backend only ever calls `https://api.github.com`. No user input chooses the host or a path
outside the endpoints this feature uses, so there is no SSRF surface.

Server-supplied URLs are held to the same origin, in both the authenticated client
(Integrations) and the unauthenticated one (Repositories):

- pagination never follows a `Link` URL whose origin is not exactly `https://api.github.com`;
- redirects to another origin are not followed, and `Authorization` is never sent to another
  host.

Repository links in the UI are built by the frontend from `owner` and `name`
([ui.md](ui.md#table)); a GitHub-supplied URL is never rendered.

## CSRF

Every route is `POST`, reads included, so `OriginGuard` covers all four
([architecture/security.md](../../architecture/security.md#csrf)). The listing's stale-sync
trigger is therefore not a state change over `GET`, and needs no exception
([api.md](api.md#stale-sync-trigger)).

## Errors and logging

- Exact codes and messages: the [error table](api.md#errors) in `api.md`.
- Sync failures never become HTTP errors: they surface only as the per-source `status` of the
  [sync state](api.md#sync-state), which the UI maps to fixed banner texts.
- GitHub error bodies and messages are never echoed to the client, nor any credential detail;
  anything unexpected is `500 INTERNAL_ERROR`.
- Credentials never appear in logs or error responses.

## Abuse and performance

- One sync per user at a time, a Refresh cooldown, a per-source page cap, and an early stop of
  the unauthenticated source on a low rate-limit budget ([sync.md](sync.md)).
- Timeouts and a parallelism bound on GitHub calls.

## Required tests

Tests for the open points above are added by the issue that settles them.

- No response of the feature contains a credential or a value derived from one.
- The Repositories module never handles a decrypted credential.
- Every route is user-scoped in the query: another user's repository answers the same `404` as a
  missing one; admins get no access; admin user endpoints carry no repository-derived field.
- No response reveals that another user holds the same GitHub repository.
- Add with a GitHub repository id not in the caller's own rows answers `404` without a GitHub
  call; one GitHub does not grant answers `404` and writes nothing.
- A `fullName` ref never resolves another user's row; every Add `404` carries the same message
  ([api.md](api.md#required-tests)).
- A cached installation token never leaves the Integrations module.
- The handle source stores no private repo.
- A `Link` or redirect to another origin is not followed, and `Authorization` never leaves
  `https://api.github.com`.
- Deleting an integration purges not-added repos only it could see.
- An invalid handle is rejected before storage; a stored handle is URL-encoded in the GitHub
  path.
- Every GitHub call targets `https://api.github.com`.
- Every route (listing and sync state included) from a foreign origin is rejected by
  `OriginGuard`.
- A GitHub error body is never returned verbatim; no credential is logged.
- A second concurrent sync and a Refresh inside the cooldown are refused.
