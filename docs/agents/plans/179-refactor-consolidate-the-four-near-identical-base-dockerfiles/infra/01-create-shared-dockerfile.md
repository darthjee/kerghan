# Create the shared base Dockerfile
Add `dockerfiles/base/Dockerfile` that reproduces the common skeleton once, driven by build args (see the per-image parameter table in [infra.md](../infra.md)).

Structure:

1. Global `ARG`s before the first `FROM` (they are only visible to `FROM` lines): `SCRIPTS_IMAGE=darthjee/scripts:0.8.0`, `NODE_IMAGE_VERSION=0.2.1`, `BASE_IMAGE` (`darthjee/node` or `darthjee/circleci_node`, no default so a forgotten arg fails loudly).
2. `FROM ${SCRIPTS_IMAGE} AS scripts` and `FROM ${BASE_IMAGE}:${NODE_IMAGE_VERSION} AS base`.
3. In `base`: re-declare the args used in the stage (`USER_NAME`, `RSYNC_VERSION`), `USER root`, then `RUN if [ -n "$RSYNC_VERSION" ]; then apt-get update && apt-get install -y --no-install-recommends rsync=$RSYNC_VERSION && rm -rf /var/lib/apt/lists/*; fi`, then `USER $USER_NAME`.
4. `FROM base AS builder`: re-declare `USER_NAME`, `HOME_DIR`, `APP_DIR`, `SOURCE_DIR`; `ENV HOME_DIR $HOME_DIR`; `COPY --chown=$USER_NAME:$USER_NAME ./$SOURCE_DIR/package.json $SOURCE_DIR/yarn.lock $APP_DIR/` (builder only, per the normalisation decision); `USER $USER_NAME`; `COPY --chown=... --from=scripts /home/scripts/builder/yarn_builder.sh /usr/local/sbin/yarn_builder.sh`; `RUN /bin/bash yarn_builder.sh`. Keep the existing TODO about a production-only-deps flag as a short comment.
5. `FROM base AS final`: re-declare `USER_NAME`, `HOME_DIR`, `YARN_CACHE_DIR`; `ENV HOME_DIR $HOME_DIR`; `COPY --chown=... --from=builder $HOME_DIR/yarn/new/ $YARN_CACHE_DIR/`; `USER $USER_NAME`.
6. One thin target per image, each `FROM final AS <image>` and carrying only its exec-form `CMD` (none for `circleci_kerghan-base`; keep the explanatory comment about the dev container mounting `./backend` for `kerghan-base`):
   - `kerghan-base`: `CMD ["sh", "-c", "yarn build && node dist/main.js"]`
   - `vite_kerghan-base`: `CMD ["npm", "run", "server"]`
   - `production_kerghan-base`: `CMD ["node", "dist/main.js"]`
   - `circleci_kerghan-base`: no `CMD`

Notes for the implementer:
- Preserve the current `-base` ARG/`FROM` ordering rule: an `ARG` declared before `FROM` must be re-declared inside a stage to be used there.
- `COPY` source paths are relative to the build context (repo root, `.`), which is what `bin/image.sh` already passes.
- Use the modern `FROM … AS …` / `ENV KEY=value` forms for the new file.

## Files to Change
- `dockerfiles/base/Dockerfile` — new shared, parameterised Dockerfile with the four named targets.
