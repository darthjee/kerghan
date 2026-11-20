# Environment Variables

Every environment variable Kerghan's production deployment needs, gathered from what the code
actually reads (not just what's documented elsewhere) — grep the `Source` column if in doubt.
Local dev's equivalent is `.env.dev.sample` (copied to `.env` by `make setup`); nothing here
should drift from that file without a reason noted below. Real `.env.prod` / CircleCI project
variables are never committed (`.gitignore`) — this doc is the map for filling them in.

The standalone image (`darthjee/kerghan-standalone`) passes a subset of these variables to its
backend; see [Standalone variables](environment-variables/standalone.md).

The variables are split by who reads them. The backend's runtime variables (secrets, token
lifetimes, rate limits, GitHub integration settings, default user) live in one table; the
setup walk-throughs and the key-rotation procedures are separate pages, as are the proxy, cache
warmer, CircleCI and standalone variables.

## Pages

| Page | Read when |
|------|-----------|
| [Backend application runtime](environment-variables/backend.md) | You need the meaning, default or source of a backend `process.env` variable. |
| [Backend setup](environment-variables/backend-setup.md) | You are configuring the default user, `KERGHAN_INTEGRATIONS_KEY`, the GitHub OAuth App or the GitHub App. |
| [Key rotation](environment-variables/key-rotation.md) | You are rotating `KERGHAN_SECRET_KEY` or `KERGHAN_INTEGRATIONS_KEY`. |
| [Proxy, Navi and CircleCI](environment-variables/proxy-navi-circleci.md) | You are filling in the production proxy, cache warmer or CI project variables. |
| [Standalone](environment-variables/standalone.md) | You need to know which variables the standalone image passes through and how. |

## Keeping this doc honest

If you add code that reads a new `process.env.*` / `getenv()` value, or wire up a var currently
marked "Reserved, not yet read," update its row here in the same change — this doc is only useful
if it matches what the code actually does.
