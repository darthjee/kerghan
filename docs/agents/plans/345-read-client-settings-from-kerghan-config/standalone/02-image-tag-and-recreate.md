# image-tag and the recreate decision

Make the wanted image honor `image-tag` and adapt `recreate_reason`.

- `image_ref <offline> [tag]`: tag defaults to `KERGHAN_VERSION`; `image-tag` replaces only the
  version part, and `-offline` is still appended for the offline variant
  (`image-tag=0.4.0` + offline → `darthjee/kerghan-standalone:0.4.0-offline`).
- `recreate_reason`: compare against the wanted version (the resolved tag without `-offline`)
  instead of the hard-coded `KERGHAN_VERSION`:
  - wanted version is semver and the running image is a semver release of `IMAGE_REPO`: current
    rules (`gt` → downgrade warning + return 1; `lt` → upgrade; equal → variant/port checks). The
    downgrade hint should name the running version; keep the CLI-version wording only when the
    wanted tag is the pinned one.
  - wanted tag is not semver (e.g. `latest`): skip version comparison and the downgrade guard;
    no-op when the running image reference equals the wanted one and the port matches, otherwise
    recreate (`replacing <current> -> <wanted>` or `moving to port <port>`).
  - running image not a semver release (existing branch): unchanged, except it must be a no-op
    when it equals the wanted non-semver image and the port matches.
- Only image and port drive recreation; `runtime` / `stop-timeout` never do.

## Files to Change
- `standalone/bin/kerghan` — `image_ref`, `recreate_reason`, the call site in `cmd_up`.
