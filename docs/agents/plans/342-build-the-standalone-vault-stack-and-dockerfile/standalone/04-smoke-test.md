# Smoke-test script

Write `standalone/scripts/smoke_test.sh` (bash, `set -euo pipefail`, executable), following the
contract in [plan.md](../plan.md):

1. Unless `SKIP_BUILD=true`, build `IMAGE` with the shared build command and
   `KERGHAN_VERSION`.
2. Generate two distinct test secrets (base64 of 32 random bytes) inside a throwaway container
   (e.g. `docker run --rm alpine sh -c 'head -c 32 /dev/urandom | base64'`) — never committed.
3. `docker run -d --privileged -v <unique volume>:/var/lib/docker -p $SMOKE_PORT:80`
   `-e KERGHAN_SECRET_KEY -e KERGHAN_INTEGRATIONS_KEY -e FRONTEND_BASE_URL=http://localhost:$SMOKE_PORT`
   with a unique container name; register a `trap` that prints the last logs on failure and
   removes the container and volume.
4. Poll `http://localhost:$SMOKE_PORT/health.json` (curl) until `200`, with a timeout of about
   5 minutes (first boot pulls three images and initializes MySQL).
5. Check `GET /` returns `200` with an HTML body containing the app's root element.
6. `docker restart` the container, poll `/health.json` again, to cover "data survives a restart
   when the volume is kept" at the stack level.
7. Check that no env file and no secret is in the image:
   `docker run --rm --entrypoint sh $IMAGE -c 'cat /vault/.env; ls -a /vault'` shows only
   `TENT_IMAGE` and `KERGHAN_VERSION`.
8. Print a clear `OK` / failure line.

## Files to Change

- `standalone/scripts/smoke_test.sh` — new.
