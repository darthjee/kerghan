# Plan: Performance: prefer parameter expansion over sed in bin/deploy_frontend.sh

Issue: [111-performance--prefer-parameter-expansion-over-sed-in-bin-deploy-frontend-sh.md](../../issues/111-performance--prefer-parameter-expansion-over-sed-in-bin-deploy-frontend-sh.md)

## Overview
Replace the `sed`-based newline substitution in `run_generate_ssh_key_file()` (`bin/deploy_frontend.sh:21`) with bash's native `${variable//search/replace}` parameter expansion, keeping the generated SSH key file byte-identical.

See [infra.md](infra.md) for the full plan.
