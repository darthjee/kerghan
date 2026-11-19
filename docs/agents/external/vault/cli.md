# Using the vault CLI

How to install and use the `vault` client, which runs a Vault image on your host for you.
Back to the [Vault guides index](../vault.md).

The `vault` CLI builds the `docker run` command (runtime, mounts, data volume, ports, env) from
a project directory and manages the resulting container:

```bash
cd my-stack            # a directory with a compose file
vault up               # start it, detached, on http://localhost:3000
vault status           # state, image, runtime, ports, volume, env keys
vault compose ps       # run "docker compose ps" inside the instance
vault logs -f          # follow the logs
vault down             # stop and remove it (the data volume is kept)
```

Every command also takes the project directory as an argument (`vault up ./my-stack`);
without it, the current directory is used. Unless said otherwise, examples on this page use
the CLI default port mapping `3000:80` (host `3000` → Vault `80`).


## Pages

| Page | Read this when… |
|------|-----------------|
| [Install](cli/install.md) | you need supported platforms, the installer, a download-and-verify flow, or shell completion. |
| [Commands](cli/commands.md) | you need the command list, `compose`/`run` arguments, exit codes or messages. |
| [Runtime](cli/runtime.md) | you need instance naming, runtime selection (sysbox/privileged) or the option table. |
| [Config files](cli/config-files.md) | you need `.vault.env`, `.vaultrc` or the precedence rules. |
| [Guardrails](cli/guardrails.md) | you need the safety checks, baked images or Docker Desktop notes. |
