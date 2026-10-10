# Stamp the installer version on bump

Extend `scripts/bump_version.sh` so it also rewrites the `KERGHAN_VERSION="..."` line of
`standalone/install.sh`, the same way it already does for `standalone/bin/kerghan`. Use the same
`^KERGHAN_VERSION="[0-9.]*"` sed and the same `[ -f ]` guard. Then `latest/download/install.sh`
from release `<v>` installs client `<v>`.

## Files to Change

- `scripts/bump_version.sh` — add `INSTALLER="$ROOT/standalone/install.sh"` and its sed block.
