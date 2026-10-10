# Infra docs

Update `docs/agents/architecture/infra.md`:

- Workflow diagram: add `release-kerghan ─ release-kerghan-standalone`. Drop "#343 will" from
  "nothing requires it yet", keeping any reference to #341 if that issue is still open.
- Jobs table: add a `release-kerghan-standalone` row (machine, multi-arch, tag only).
- New subsection "`release-kerghan-standalone` — the standalone image on Docker Hub". It covers:
  - the four tags and the two Dockerfile targets;
  - the `standalone/images/<arch>/` tarball step;
  - the offline smoke test on amd64 (arm64 checked by hand);
  - `latest` / `latest-offline` promoted only after the smoke test passes.
- Scripts table: add `bin/release_kerghan_standalone.sh`.
- Update the sentence in the `release-kerghan` section that says #343 adds the standalone release.

Also check `docs/agents/specs/standalone/images.md`. Change it only if it contradicts the tag
scheme or the promote-after-smoke behavior.

## Files to Change

- `docs/agents/architecture/infra.md`: job, diagram, scripts table, new subsection.
- `docs/agents/specs/standalone/images.md`: only if something there is inconsistent.
