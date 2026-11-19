# Create the pages and slim the hub
Create `docs/agents/environment-variables/` with the five pages from the issue, each starting with an `# <Title>` heading and a one-line back-link to the hub. Move the text verbatim from `environment-variables.md`:

- `backend.md` — section 1 (lines 12–93).
- `backend-setup.md` — "Default user: values and boot validation", "Setting `KERGHAN_INTEGRATIONS_KEY`", "Setting up the GitHub OAuth App", "Setting up the GitHub App" (lines 94–241).
- `key-rotation.md` — both rotation sections (lines 242–335).
- `proxy-navi-circleci.md` — sections 2, 3 and 4 (lines 336–380).
- `standalone.md` — section 5 (lines 381–423).

Fix relative links in the moved content: pages sit one level deeper, so `modules/...` → `../modules/...`, `standalone.md` → `../standalone.md`, `standalone/...` → `../standalone/...`. Within the moved text, rewrite the in-file anchors (`#5-standalone-...`, `#default-user-values-and-boot-validation`, "section 1/5" mentions) to links to the new pages.

Reduce `environment-variables.md` to the hub: keep the intro (updating the "section 5" link to `environment-variables/standalone.md`), add a 1–2 paragraph summary, keep "Keeping this doc honest", and end with an index linking all five pages with a one-line "read when" description each.

## Files to Change
- `docs/agents/environment-variables.md` — slim to hub with page index.
- `docs/agents/environment-variables/backend.md` — new.
- `docs/agents/environment-variables/backend-setup.md` — new.
- `docs/agents/environment-variables/key-rotation.md` — new.
- `docs/agents/environment-variables/proxy-navi-circleci.md` — new.
- `docs/agents/environment-variables/standalone.md` — new.
