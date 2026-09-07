# Template registry + nest-cli assets + MAIL_TEMPLATES token

Introduce the boot-time template registry: a directory scan over
`backend/src/mail/templates/<name>/` that returns a frozen
`Record<name, { subject, text, html? }>` of **raw, pre-interpolation** content. Add the DI token
it is provided under, and teach `nest build` to copy the non-TS template files into `dist/` so
the scan works under `node dist/main.js` as well as `nest start`.

## What to build

### `mail.tokens.ts` — new token

Add alongside `MAIL_CONFIG` / `MAIL_TRANSPORT` / `MAIL_METHODS`:

```ts
/**
 * Injection token for the frozen raw template registry built at boot by
 * `template-registry.ts` (see `mail.module.ts`'s `MAIL_TEMPLATES` provider).
 */
export const MAIL_TEMPLATES = 'MAIL_TEMPLATES';
```

### `template-registry.ts` — new file

- Exports:
  - `interface RawTemplate { subject: string; text: string; html?: string }`
  - `type TemplateRegistry = Readonly<Record<string, RawTemplate>>`
  - `function buildTemplateRegistry(templatesDir: string): TemplateRegistry`
- `buildTemplateRegistry`:
  - If `templatesDir` does not exist (`node:fs` `existsSync`) → return `Object.freeze({})`.
  - `readdirSync(templatesDir, { withFileTypes: true })`, keep only entries where `isDirectory()`.
  - For each template directory `<name>`:
    - Require `subject.txt` and `body.txt`. If either is missing →
      `throw new Error("mail: template '<name>' is missing subject.txt")` (or `body.txt`),
      naming the first missing file.
    - `subject`: `readFileSync(.../subject.txt, 'utf8')` with a **single trailing `\r?\n` stripped**
      (so an editor's trailing newline can't trip the header-injection guard later).
    - `text`: `readFileSync(.../body.txt, 'utf8')` **verbatim** (no trimming).
    - `html`: only if `body.html` exists → `readFileSync(.../body.html, 'utf8')` verbatim;
      otherwise the key is **absent** (not `undefined`).
    - `Object.freeze` each `RawTemplate`.
  - Return `Object.freeze(registry)`.
- Keep helpers small (one `readTemplateDir(dir, name)` internal is fine) to satisfy
  `eslint-plugin-complexity`. Full JSDoc on the two exported symbols and `buildTemplateRegistry`.
- Uses `node:fs` + `node:path` only — **no** `import.meta`, no `process.cwd()`, no `process.env`.

### `nest-cli.json` — copy templates into `dist/`

Extend `compilerOptions` (currently `deleteOutDir` + `tsConfigPath`) with:

```json
"assets": [
  { "include": "mail/templates/**/*", "watchAssets": true }
]
```

`include` is resolved relative to `sourceRoot` (`src`), so files land at
`dist/mail/templates/<name>/…`. `watchAssets` keeps `nest start --watch` in sync.

### `backend/src/mail/templates/.gitkeep` — new empty file

Keeps the directory present in git even though no production template ships yet. The scan
iterates directories only, so a bare `.gitkeep` file yields an empty registry.

## Files to Change

- `backend/src/mail/mail.tokens.ts` — add the `MAIL_TEMPLATES` token (+ JSDoc).
- `backend/src/mail/template-registry.ts` — **new**: `buildTemplateRegistry`, `RawTemplate`,
  `TemplateRegistry`.
- `backend/nest-cli.json` — add `compilerOptions.assets` for `mail/templates/**/*`.
- `backend/src/mail/templates/.gitkeep` — **new**, empty.
