# bats tests

Add the bats suite that covers every test required by the issue.

**Harness** (`standalone/test/helpers/setup.bash`, loaded by each file):
- `setup` creates a temporary `HOME` and a stub bin directory, puts it first on `PATH`, and
  sets `STUB_LOG` to a file.
- The `vault`, `docker` and `openssl` stubs in `standalone/test/stubs/` append `<name>
  <args...>` to `$STUB_LOG`. Their behavior is driven by env vars:
  - `STUB_VOLUME_EXISTS=1`;
  - `STUB_RUNNING_IMAGE=darthjee/kerghan-standalone:0.4.0`;
  - `STUB_RUNNING_PORT=3000`;
  - `STUB_VAULT_UP_EXIT=1` with `STUB_VAULT_UP_STDERR=...`;
  - `openssl` prints a fixed or incrementing fake key.
- `setup` copies or symlinks the stubs into the temporary bin directory.
- Tests run the script by its absolute path,
  `"$BATS_TEST_DIRNAME/../bin/kerghan"`. For a pure helper (for example `version_compare`),
  `source` the script.

**Files and cases:**
- `args.bats`:
  - `vault` arguments for `up`, `up --offline`, `up -p 8080`, `up -f`, `down`, `logs`,
    `logs -f`, `status`, and `compose exec mysql sh`. `--name kerghan` and the
    `--image`/`--env-file`/`-p` pieces must be exact.
  - Unknown command or flag gives usage and exit 2; a bad port is rejected.
  - `version` prints the pinned version, and `help` prints the usage.
- `secrets.bats`:
  - the first `up` creates `~/.kerghan/kerghan.env` with both keys and mode 600 (`stat -c %a`
    on the Alpine-based bats image);
  - an existing file is never rewritten (compare the contents and mtime before and after);
  - the refusal when the file is missing but the volume exists: exit 1, the hint present, and
    no `vault` line in `STUB_LOG`.
- `frontend_base_url.bats`:
  - the default `-e FRONTEND_BASE_URL=http://localhost:3000`, and with `-p 8080`;
  - no `-e` when `kerghan.env` sets `FRONTEND_BASE_URL`.
- `upgrade.bats`:
  - an older running version gives `vault down` then `vault up` with the new image, and no
    `docker volume rm`;
  - a variant swap recreates the instance; so does a port change;
  - the same image and port is a no-op (no `vault up`), and prints the URL;
  - a newer running version gives the downgrade warning, exit 1 and no `vault down`;
  - a non-semver tag recreates the instance with a warning;
  - `version_compare` unit cases.
- `port.bats`: a failing `vault up` with a port-conflict stderr shows the `-p` hint and
  propagates the exit code.
- `reset.bats`:
  - `n` / empty input does nothing (no `vault` or `docker volume rm`);
  - `y` runs `vault down` and then `docker volume rm vault-kerghan-data`;
  - `kerghan.env` survives.

Run `docker-compose run --rm standalone_tests` once the infra agent's service exists. Before
that, run `docker run --rm -v "$PWD/standalone:/standalone" bats/bats:1.11.0 /standalone/test`.

## Files to Change
- `standalone/test/helpers/setup.bash` — new: the shared setup/teardown, `PATH` stubbing and log
  assertions
- `standalone/test/stubs/vault`, `standalone/test/stubs/docker`,
  `standalone/test/stubs/openssl` — new: executable stubs driven by env vars
- `standalone/test/args.bats`, `secrets.bats`, `frontend_base_url.bats`, `upgrade.bats`,
  `port.bats`, `reset.bats` — new: the test cases above
