# Repositories — Integrations module

What the Repositories feature needs from the [Integrations module](../../modules/integrations.md),
which exports nothing today. Part of the [Repositories specs](README.md).

## Exported service

The Integrations module **exports a service that performs authenticated GitHub requests for a
given (user, integration)**.

- The decrypted credential **never leaves the module**: the Repositories module never sees it,
  stores it or logs it.
- The request is scoped by the owner: an integration of another user is never used.
- Used for:
  - listing the repositories an integration can see ([sync.md](sync.md#sources));
  - fetching the GitHub handle's public repositories through a valid integration;
  - the Add re-check ([api.md](api.md#add)).
- Errors come back as a fixed set of statuses, never by echoing GitHub's response body.
- Integration types in scope: `pat`, `oauth_app`, `github_app`.

- A minted GitHub App installation token is a credential: if cached, it stays inside this
  module, in memory or in the integration's own encrypted record. Any other persistence needs
  its own product decision ([security.md](security.md#credentials-stay-in-the-backend)).
- Server-supplied `Link` and redirect URLs are held to `https://api.github.com`
  ([security.md](security.md#fixed-github-base-url)).

> **Open — settled by #448:** the exported interface (preferably fixed, `GET`-only operations —
> list repos, get a repo by id, list a handle's public repos — rather than a generic
> `request(path)`), per-type authentication (including GitHub App installation-token minting and
> caching, within the limit above), the GitHub endpoint and parameters per type, and the error
> mapping (sanitised like the existing test-connection errors).

## Invalid on 401

A `401` from GitHub on a request made through an integration sets that integration's status to
`invalid`, inside the Integrations module. Transient failures (network errors, `5xx`, rate
limits) never change the status, as for test connection today.

## Access link on Add

When the user adds a repository:

- Among the integrations that returned the repo in their latest sync, the **oldest** one that is
  not `invalid` is chosen and stored as `integration_id`.
- When only the public source sees it, no integration is linked and the re-check is
  unauthenticated.
- Changing the link later is out of scope.

> **Open — settled by #448:** whether `expired` and `undecryptable` integrations count as
> usable for the access-link choice and for fetching the handle's repos.

## Deletion hook

When an integration is deleted, the Repositories module is told, so it can drop the source rows
and clear `integration_id` ([model.md](model.md#logical-foreign-keys)). There is no database
cascade between the two modules.

> **Open — settled by #448:** the mechanism (a direct call vs an event).

## Required tests

Tests for the open points above are added by the issue that settles them.

- The exported service never returns, logs or exposes the decrypted credential or a minted
  installation token.
- It refuses an integration that does not belong to the given user.
- A `401` sets the integration `invalid`; a transient failure leaves its status unchanged.
- Add links the oldest non-`invalid` integration that sees the repo, and none when only the
  public source does.
- Deleting an integration notifies the Repositories module.
