# Document the verification checklist
Add a "Verifying the effective client IP" subsection to `docs/agents/standalone.md`, right after "Effective client IP". It describes how to run the script and lists one entry per #384 check, with the exact command and what counts as pass:

1. Linux, native Docker, Sysbox: `RUNTIME=sysbox BIND=127.0.0.1` and `BIND=0.0.0.0` probe runs. Pass: address inside the allowlist.
2. Linux, native Docker, `--privileged`: same as 1 with `RUNTIME=privileged`.
3. Linux, `BIND=0.0.0.0` with `HOLD=true`: curl from a LAN machine. Pass: the LAN machine's private address is reported, inside the allowlist.
4. Linux, Docker Engine 28+, `BIND=127.0.0.1`: `reach` mode plus the LAN one-liner. Pass: unreachable from every non-loopback interface and from the LAN.
5. End to end, with the first released image containing #368–#372: `kerghan up` with default settings, then `e2e` mode, plus opening the URL in the host browser. Pass: logged in as `admin`.
6. Docker Desktop for macOS, `BIND=0.0.0.0`: probe run, repeated with Docker Desktop network settings varied where relevant (e.g. the networking mode / "host networking" toggle, any VPN or proxy turned off). Record whether `172.64.155.209` (or another non-private address) reproduces, and anything that changes it.

Link the subsection from the "Effective client IP only measured on Docker Desktop for macOS" caveat, and mention the script next to the smoke-test row of the tooling table.

## Files to Change
- `docs/agents/standalone.md` — new "Verifying the effective client IP" subsection, a caveat link, and a tooling-table mention.
