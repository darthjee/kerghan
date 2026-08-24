# Update docker-compose.yml for the new entrypoint

`docker-compose.yml`'s backend services (`kerghan_app`, `kerghan_tests`, `kerghan_prod_app`)
currently rely entirely on each image's own `CMD` (no `command:` override in the compose file
itself) — confirm this stays true after the NestJS migration, and adjust only if the new build
needs a compose-level command (e.g. running `yarn build && node dist/main.js` in dev instead of
relying on the image having pre-built `dist/`, for faster dev-loop rebuilds without a full image
rebuild on every source change).

- Verify whether the dev workflow needs a `command:` override on `kerghan_app`/`kerghan_tests`
  to run the build against the live-mounted `./backend:/home/node/app` volume (since the volume
  mount means the image's own pre-built `dist/` would be stale as soon as source changes) — if
  so, add one (e.g. `command: sh -c "yarn build && node dist/main.js"` for `kerghan_app`, or a
  `yarn start:dev` watch-mode script for a better dev loop).
- Confirm no other service (`kerghan_proxy`'s `links: [kerghan_app:backend]`, `kerghan_phpmyadmin`)
  needs changes — the internal port (`8080`) and MySQL link should stay identical since only the
  app framework changed, not the transport.

## Files to Change

- `docker-compose.yml` — `kerghan_app`/`kerghan_tests` command override, if needed for the
  dev-loop volume-mount case above
