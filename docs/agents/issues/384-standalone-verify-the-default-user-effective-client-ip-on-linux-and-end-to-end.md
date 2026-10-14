# Issue: Standalone: verify the default-user effective client IP on Linux and end to end

## Description
Follow-up to Epic #366, split out from #373.

#371 measured the effective client IP inside the standalone stack (host, outer Docker port publishing, Vault container, inner Docker port publishing, Tent, backend) on Docker Desktop for macOS (arm64) only. The other platforms and the full end-to-end path are still unverified. They are listed as caveats in `docs/agents/standalone.md` ("Effective client IP" section and the "Effective client IP only measured on Docker Desktop for macOS" caveat).

## Problem
Automatic login as `admin` depends on the client IP the backend sees falling inside `KERGHAN_DEFAULT_USER_ALLOWED_IPS` (loopback plus private ranges), and the real exposure guard is the default `bind=127.0.0.1`. Neither assumption has been verified on Linux, and no one has confirmed end to end with a real image that the default settings log the host browser in as `admin`. If the effective IP differs on Linux, automatic login could silently fail there. If the loopback bind leaks, admin access could be exposed to the LAN.

## Expected Behavior
Each check below has a recorded result (pass/fail plus the observed source address):

1. **Linux, native Docker, with Sysbox:** the effective client IP the backend sees for a host request, with `bind=127.0.0.1` and with `bind=0.0.0.0`.
2. **Linux, native Docker, without Sysbox (`--privileged`):** the same measurement.
3. **Linux, `bind=0.0.0.0`:** a LAN client arrives with its real private address, inside the allowlist.
4. **Linux, Docker Engine 28 or later:** the default `bind=127.0.0.1` cannot be reached from other interfaces or LAN hosts (see moby#45610).
5. **End to end:** with the first released `kerghan-standalone` image that contains the default-user work (#368–#372) and default settings, `status.json` reports `admin` in the host browser. Run on macOS, and on Linux too if possible.
6. **Docker Desktop for macOS, `bind=0.0.0.0`:** find out why the backend saw a non-private source address (`172.64.155.209`), e.g. Docker Desktop's all-interface port forwarder or something specific to that machine.

## Solution
- **Who does what:** the user runs the checks on their own machines (a Linux host with native Docker, a second LAN machine, and the macOS machine). The agent's job is to:
  - prepare a short, copy-pasteable verification checklist/script (how to read the effective IP the backend sees, how to probe reachability from another interface/LAN host, how to check Engine version and runtime) and add it to `docs/agents/standalone.md` or as a helper next to the standalone tooling;
  - record the results the user reports in `docs/agents/standalone.md`: update the "Effective client IP" table and notes, and update or remove the matching caveat entries.
- **Image:** the end-to-end check waits for the next released `kerghan-standalone` tag that includes #368–#372. It does not use a locally built image.
- **macOS investigation:** stays in this issue (item 6), with the finding (or "not reproduced / cause unconfirmed") recorded in the same section.
- **Follow-ups:** if the results show that the allowlist (`KERGHAN_DEFAULT_USER_ALLOWED_IPS`), `KERGHAN_TRUSTED_PROXY_HOPS`, or the default `bind` is wrong, open a separate issue to change them. Do not change behavior in this issue.

### Acceptance criteria
- The verification checklist/script exists and is referenced from `docs/agents/standalone.md`.
- `docs/agents/standalone.md` records the results of items 1–6 (observed addresses, platform, Docker Engine version, runtime), and the caveats list reflects what remains unverified.
- Any result that calls for a behavior change has its own follow-up issue linked from the docs.

## Benefits
- Confirms that automatic login works on the main platforms, not just Docker Desktop for macOS.
- Confirms that the default loopback bind really protects automatic admin login on Linux.
- Replaces open caveats with measured facts, or turns them into concrete follow-up issues.
