# Verify no permanent doc links to the specs

Run:

```bash
grep -rn "specs/standalone" --include='*.md' . | grep -v -e '^./docs/agents/specs/' -e '^./docs/agents/issues/' -e '^./docs/agents/plans/' -e node_modules
```

The only allowed hit is the "Standalone distribution" entry in `docs/agents/specs.md`, which
#348 removes. Also check the relative links in every edited file (e.g. `../standalone.md` from
`architecture/infra.md`, `standalone.md#caveats` anchors from the README).

Finally, read `README.md` and `docs/agents/standalone.md` alone and check that they cover how to
install, run, configure and upgrade standalone Kerghan, without the specs.

## Files to Change

- None (verification only)
