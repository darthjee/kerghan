# Plan: Installer: bash completion setup in `install.sh`

Issue: [430-installer-bash-completion-setup-in-install-sh.md](../../issues/430-installer-bash-completion-setup-in-install-sh.md)

## Overview

Add a never-fatal completion step to `standalone/install.sh`. The step writes `<install dir>/kerghan completion bash` to the bash-completion user directory through a temp file and `mv -f`. The plan also updates the installer header, extends the installer test harness with root-proof failure injection and a configurable stub client, and adds `install_completion.bats` with every case in `docs/agents/specs/auto-complete/install.md`'s Required tests. Single owner: the standalone agent.

See [standalone.md](standalone.md) for the full plan.
