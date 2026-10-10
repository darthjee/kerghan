# `up` decision logic

Implement `cmd_up` in this order:

1. **Refuse:** if `$ENV_FILE` is missing and `docker volume inspect vault-kerghan-data`
   succeeds, print `kerghan: error: ~/.kerghan/kerghan.env is missing but the data volume
   vault-kerghan-data exists` and the hint `restore kerghan.env from your backup, or run
   'kerghan reset' to start from scratch`. Exit 1, with no `vault` call.
2. **Secrets:** if `$ENV_FILE` is missing (and no volume exists):
   - `mkdir -p "$KERGHAN_HOME"`, then write the file under `umask 077` and `chmod 600` it;
   - write `KERGHAN_SECRET_KEY=<openssl rand -base64 32>` and
     `KERGHAN_INTEGRATIONS_KEY=<openssl rand -base64 32>`;
   - print a one-line notice that secrets were generated and the file should be backed up.

   Never touch an existing file.
3. **`FRONTEND_BASE_URL`:** if `grep -q '^FRONTEND_BASE_URL=' "$ENV_FILE"` fails, add
   `-e FRONTEND_BASE_URL=http://localhost:<port>` to the `vault up` arguments. Otherwise pass
   nothing, so the file wins.
4. **Compare with the running instance.** Read the container's image and host port:
   - `docker inspect -f '{{.Config.Image}}' vault-kerghan` for the image;
   - `docker inspect -f '{{(index (index .NetworkSettings.Ports "80/tcp") 0).HostPort}}'
     vault-kerghan` for the port, or parse `vault status --name kerghan`'s `image:` and `ports:`
     lines. Pick one source and use it consistently.
   - Use `docker inspect -f '{{.State.Running}}'` for the state. A stopped container counts as
     "no running instance", since `vault up` already replaces stopped instances.

   Parse the running tag into a version and a variant (the `-offline` suffix). Compare the
   versions with a bash 3.2 semver comparison (`IFS=. read` and numeric compares).
   - **Newer than the CLI:** print `kerghan: warning: the running instance uses <image>, newer
     than this CLI (<KERGHAN_VERSION>); downgrades are unsupported`, plus a hint to install the
     matching CLI. Exit 1 without recreating it.
   - **Same image and same port:** print `Kerghan is already running at
     http://localhost:<port>` and exit 0, with no `vault` call.
   - **Older version, other variant, or different port:** print one line naming the reason
     (`upgrading <old> -> <new>`, `switching to the offline/online variant`, or `moving to port
     <p>`). Then run `vault down --name kerghan`, then the normal `vault up`. The volume is
     never touched.
   - **A tag that is not a version** (for example `latest`, or a local `dev`): treat it as
     "different image" and recreate it, with a warning.
   - **No container:** a plain `vault up`.
5. **Run `vault up`** with the built arguments. If it fails, keep Vault's stderr. If the
   failure looks like a port conflict (Vault's `choose another host port` hint, or `port is
   already allocated` / `address already in use`), add `kerghan: hint: use 'kerghan up -p
   <port>' to pick another port`. Exit with Vault's code.
6. On success in detached mode, print `Kerghan is running at http://localhost:<port>`.

## Files to Change
- `standalone/bin/kerghan` — add `cmd_up` and its helpers (`ensure_env_file`,
  `volume_exists`, `running_image`, `running_port`, `version_compare`, `frontend_base_url_args`)
