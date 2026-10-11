# Bump the thin Dockerfile's version

Extend `scripts/bump_version.sh` so a release bump also rewrites the `FROM` tag of the thin Render
Dockerfile, keeping the guard in step 03 satisfied on every properly bumped release.

- Add `RENDER_DOCKERFILE="$ROOT/dockerfiles/production_kerghan/Dockerfile"` next to the other path
  variables.
- Add a block in the same style as the CLI/installer ones (guarded by `[ -f ... ]`, macOS
  `sed -i ''`, matching the script's existing convention):
  `s|^FROM darthjee/kerghan:[0-9.]*$|FROM darthjee/kerghan:${new_version}|`, with a one-line
  comment explaining it pins the image Render deploys.
- No automated test (the script uses macOS `sed -i ''`, which the Linux bats image cannot run;
  making it portable is out of scope). Verify by running it locally against a scratch copy or by
  reading the diff: the bump PR's diff must show the new version on the `FROM` line.

## Files to Change
- `scripts/bump_version.sh` — also rewrite `FROM darthjee/kerghan:<version>` in `dockerfiles/production_kerghan/Dockerfile`
