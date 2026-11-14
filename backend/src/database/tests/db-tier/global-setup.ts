import Module from 'module';

const RELATIVE_JS = /^\.{1,2}\/.*\.js$/;

type ResolveFilename = (request: string, ...rest: unknown[]) => string;

// `Module._resolveFilename` is Node's internal CommonJS resolver; it is not
// part of `@types/node`'s public typings.
const cjsModule = Module as unknown as { _resolveFilename: ResolveFilename };

/**
 * Jest `globalSetup` for the DB-backed tier: migrates the test database once
 * per run (see `migrate-test-database.ts`).
 *
 * Global setup runs in Jest's own process, where the `.js` → `.ts`
 * `moduleNameMapper` does not apply. Jest's swc transform compiles this
 * file (and every `.ts` it requires) to CommonJS, so the NodeNext-style
 * `./x.js` imports used across the source (migrations included) are
 * resolved to their `.ts` files by wrapping Node's CommonJS resolver, only
 * while setup runs. This works on every Node version (unlike
 * `module.registerHooks`, Node 22.15+). That is also why the tier modules
 * are imported lazily, after the wrapper is in place.
 *
 * @returns resolves once migrations have been applied.
 */
export default async function globalSetup(): Promise<void> {
  const original = cjsModule._resolveFilename;

  cjsModule._resolveFilename = function resolveTsFallback(request, ...rest) {
    try {
      return original.call(this, request, ...rest);
    } catch (error) {
      if (!RELATIVE_JS.test(request)) throw error;
      return original.call(this, request.replace(/\.js$/, '.ts'), ...rest);
    }
  };

  try {
    const { migrateTestDatabase } = await import('./migrate-test-database.js');

    await migrateTestDatabase();
  } finally {
    cjsModule._resolveFilename = original;
  }
}
