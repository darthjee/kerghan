# Integration type: GitHub App installation (`github_app`)

Part of the [Integrations module](../integrations.md). Defines the `github_app` type, following the
[type contract](type-contract.md#what-a-type-doc-must-contain) and its
[redirect flow invariants](type-contract.md#redirect-flow-invariants). It fills every
per-type slot the generic module leaves open. Code: `backend/src/integrations/types/github-app/`.

## Overview

- The user installs Kerghan's GitHub App on a GitHub account (theirs or an organization's), or
  connects an installation they can already access, and Kerghan stores **which installation**
  it is as an integration. No token is stored: installation access tokens are minted on demand
  from the app's private key.
- **Flow kind:** redirect-based only (see [Flow](github-app/flow.md#flow)).
- **Server config:** optional. Without the app's id, slug, private key, client id and client
  secret the type is **disabled** (see [Server config](github-app/config-and-proxy.md#server-config)).
- GitHub's exact endpoints, parameters, headers, redirect behaviour and token limits below follow
  GitHub's GitHub App and REST API docs.

### Why ownership has to be verified

The `installation_id` GitHub's redirect carries proves nothing: it is a small, sequential,
guessable number, and anyone can type it into the callback. The `state` only proves the caller
started a flow, not that they own the installation. And an app-authenticated (JWT)
`GET /app/installations/{id}` sees **every** installation of the app. With `state` alone, any
Kerghan user could start a flow, skip GitHub, and post another account's `installation_id`,
claiming that account's private repositories.

So the app enables **Request user authorization (OAuth) during installation**. The redirect then
also carries a `code`, which the backend exchanges for a user-to-server token, and the
installation is accepted only if GitHub lists it among **that user's** installations
(`GET /user/installations`). The user token is then revoked and discarded; it is never stored.

## Pages

- [Flow](github-app/flow.md): read when working on the start, landing, callback or select routes, or the `state` table.
- [Credentials and verification](github-app/credentials.md): read when working on the user token, required permissions, ownership checks, secret and metadata shapes, test connection or `invalid` reason codes.
- [Server config and proxy](github-app/config-and-proxy.md): read when working on the `KERGHAN_GITHUB_APP_*` variables, the disabled state or the Tent landing rule.
- [Lifecycle, access, errors and frontend](github-app/lifecycle.md): read when working on deletion, access rules, the error-code summary or the UI.
