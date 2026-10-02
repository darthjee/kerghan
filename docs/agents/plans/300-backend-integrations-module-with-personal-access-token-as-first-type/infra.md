# Infra Plan: Backend: integrations module with Personal Access Token as first type

Main plan: [plan.md](plan.md)

## Shared contracts

- Add `KERGHAN_INTEGRATIONS_KEY` to the dev sample, set to the public placeholder
  `a2VyZ2hhbi1kZXYtaW50ZWdyYXRpb25zLWtleS0zMmI=`. The backend defines the same literal as
  `INTEGRATIONS_KEY_DEV_PLACEHOLDER` and refuses it when `NODE_ENV=production`.
- The optional numeric vars `KERGHAN_INTEGRATIONS_MAX_PER_USER` (20),
  `KERGHAN_INTEGRATIONS_CREDENTIAL_MAX_ATTEMPTS` (5), `KERGHAN_INTEGRATIONS_CREDENTIAL_LOCK_MS`
  (900000) and `KERGHAN_INTEGRATIONS_TEST_COOLDOWN_MS` (30000) run on their code defaults. Don't
  set them in the sample; document them only.

## Implementation Steps

### Step 1 — Dev sample, docker-compose and secret scanner

- Add `KERGHAN_INTEGRATIONS_KEY=<placeholder>` to `.env.dev.sample` under "Backend framework
  settings". Add a comment that it is a public dev-only key and how to generate a real one
  (`openssl rand -base64 32`).
- `docker-compose.yml` services already load `env_file: .env`, so no compose change should be
  needed. Confirm this for every backend service, including the test service used by
  `make tests`. `kerghan_prod_app` uses `.env.prod`, which is never committed, so it has nothing
  to update in-repo.
- Add an `ignored_matches` entry to `.gitguardian.yaml` for the placeholder, named like the
  existing entries ("integrations dev/test placeholder key, rejected in production by boot
  validation").
- **CircleCI:** the backend jobs only run `lint` and `coverage`, and the specs build their
  config in-process, so no job boots the app with real env. Verify this. Change
  `.circleci/config.yml` only if some job does need the variable; otherwise leave it unchanged
  and say so in the PR.
- Existing local `.env` files are not regenerated (`make` only copies the sample when `.env`
  is missing). Note in the PR that developers must add the line by hand.

### Step 2 — Document the env vars and the production step

In `docs/agents/environment-variables.md` section 1, add one row per variable from the shared
contracts, with status, purpose and source (`backend/src/integrations/integrations-key.ts`, plus
the services reading the numeric ones). Then add a "Setting `KERGHAN_INTEGRATIONS_KEY`"
subsection that covers:

- it must be set on the backend host (Render) **before** deploying #300, or boot fails;
- generate it with `openssl rand -base64 32`;
- it must differ from `KERGHAN_SECRET_KEY`;
- the placeholder is refused in production;
- losing or changing the key makes every stored secret `undecryptable`, and rotation is #305.

## Files to Change

- `.env.dev.sample`: add the placeholder key.
- `.gitguardian.yaml`: ignore the placeholder.
- `docs/agents/environment-variables.md`: the variable rows and the production subsection.
- `.circleci/config.yml` / `docker-compose.yml`: only if the verification above finds a gap.

## Notes

- Keep the placeholder byte-for-byte identical to the backend constant.
