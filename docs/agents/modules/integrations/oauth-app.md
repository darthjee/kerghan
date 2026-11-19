# Integration type: GitHub OAuth App (`oauth_app`)

Part of the [Integrations module](../integrations.md). Defines the `oauth_app` type, following the
[type contract](type-contract.md#what-a-type-doc-must-contain) and its
[redirect flow invariants](type-contract.md#redirect-flow-invariants). It fills every
per-type slot the generic module leaves open. Code: `backend/src/integrations/types/oauth-app/`.

## Overview

- The user clicks *Connect with GitHub*, approves Kerghan's OAuth App on GitHub, and Kerghan
  stores the resulting user access token as an integration.
- **Flow kind:** redirect-based only (see [Flow](oauth-app/flow.md#flow)).
- **Server config:** optional. Without the app's client id and secret the type is **disabled**
  (see [Server config](oauth-app/config-and-proxy.md#server-config)).
- GitHub's exact endpoints, parameters, headers and token limits below follow GitHub's OAuth App
  and REST API docs.

## Pages

- [Flow](oauth-app/flow.md) — read this for the routes, start, landing, callback and the `state` record.
- [Credentials](oauth-app/credentials.md) — read this for required scopes, validate/create, secret payload and metadata shapes, expiry, test connection, `invalid` reason codes and the `secretHint` format.
- [Config and proxy](oauth-app/config-and-proxy.md) — read this for server config, when the type is disabled, and the Tent landing page rule and backend routes.
- [Lifecycle](oauth-app/lifecycle.md) — read this for revocation, behaviour on delete, access, error cases and the frontend.
