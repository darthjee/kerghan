# Security

The privileges Vault needs, their risks, and where Vault runs and does not run.
Back to the [Vault guides index](../vault.md).

Running a Docker daemon inside a container needs elevated privileges. Know the trade-offs
before you deploy Vault.

## Runtimes

| Runtime | Flag | Status |
|---------|------|--------|
| Sysbox | `--runtime=sysbox-runc` | Recommended. |
| Privileged | `--privileged` | Fallback; read [`--privileged` is dangerous](#--privileged-is-dangerous) first. |

## `--privileged` is dangerous

`--privileged` disables most of the isolation between the container and the host:

- a process that escapes the container is effectively root on the host;
- the container gets access to all host devices;
- seccomp and AppArmor profiles are disabled;
- most managed platforms refuse privileged containers.

## Prefer Sysbox

With the [Sysbox](https://github.com/nestybox/sysbox) runtime (`--runtime=sysbox-runc`), the
Vault container runs in its own user namespace: root inside the container is not root on the
host, and no `--privileged` flag is needed. Sysbox must be installed on the host.

## Root inside the container

Processes run as root inside the Vault container (the inner daemon needs it), and the inner
containers run under that daemon. Under Sysbox, that root is mapped to an unprivileged user
on the host; under `--privileged`, it is not.

## Never expose the inner Docker socket

Vault starts `dockerd` with an explicit unix `--host` only: the inner daemon has no TCP
listener.

- Never add a TCP listener to the inner daemon.
- Never publish port `2375` or `2376`: anyone reaching it controls the daemon, and through it
  the Vault container.

## Do not mount the host's `docker.sock`

Do not mount the host's `/var/run/docker.sock` into Vault. It is unsupported, and it hands the
host's Docker daemon to the inner stack. Vault always runs its own inner daemon.

## Secrets

- Keep env files holding secrets (e.g. `.vault.env`, `.env`) out of git.
- Never bake secrets into a derived image: anyone who can pull the image can read them.
- Pass secrets at run time instead (`-e`, `--env-file`).

Details are in [configuration.md → Secrets handling](configuration.md#secrets-handling).

## Supported runtimes and platforms

| | Supported | Unsupported |
|---|-----------|-------------|
| Runtimes | Sysbox (`--runtime=sysbox-runc`, recommended), `--privileged` (fallback). | Rootless Docker; hand-picked capabilities (`--cap-add`); mounting the host's `docker.sock` instead of running an inner daemon. |
| Hosts | Docker Desktop and Linux hosts. | Most managed platforms (ECS Fargate, Cloud Run, Kubernetes without privileged pods), since they refuse privileged containers. |
| Architectures | `linux/amd64`, `linux/arm64`. | Any other architecture. |
