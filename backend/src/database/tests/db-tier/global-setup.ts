import { registerHooks } from 'module';

const RELATIVE_JS = /^\.{1,2}\/.*\.js$/;

/**
 * Jest `globalSetup` for the DB-backed tier: migrates the test database once
 * per run (see `migrate-test-database.ts`).
 *
 * Global setup runs in Jest's own process, where the `.js` → `.ts`
 * `moduleNameMapper` does not apply, so the NodeNext-style `./x.js`
 * imports used across the source (migrations included) are resolved to
 * their `.ts` files by a resolve hook, active only while setup runs. That is
 * also why the tier modules are imported lazily, after the hook is in place.
 *
 * @returns resolves once migrations have been applied.
 */
export default async function globalSetup(): Promise<void> {
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      try {
        return nextResolve(specifier, context);
      } catch (error) {
        if (!RELATIVE_JS.test(specifier)) throw error;
        return nextResolve(specifier.replace(/\.js$/, '.ts'), context);
      }
    },
  });

  try {
    const { migrateTestDatabase } = await import('./migrate-test-database.js');

    await migrateTestDatabase();
  } finally {
    hooks.deregister();
  }
}
