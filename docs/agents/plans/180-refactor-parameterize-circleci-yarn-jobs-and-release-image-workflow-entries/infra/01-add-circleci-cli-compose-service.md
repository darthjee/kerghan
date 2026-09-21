# Add circleci-cli compose service
Add a service to `docker-compose.yml` (e.g. `circleci`) that runs the CircleCI CLI against this repo's `.circleci/config.yml`, so the config can be validated without installing anything on the host. Use a pinned, official CircleCI CLI image tag, mount the repo (or at least `.circleci/`) read-only as the working directory, and set the entrypoint so `docker-compose run --rm circleci config validate` and `... config process` both work. Verify against the *current* (unmodified) config first: it must validate cleanly before any refactor begins.

## Files to Change
- `docker-compose.yml` — add the `circleci` (CircleCI CLI) service; do not attach it to `.env` or the MySQL links.
