// Jest settings shared by the default config (`jest.config.ts`) and the
// DB-backed tier's `jest.db.config.ts`, so both compile and resolve source
// identically.
//
// Plain CommonJS on purpose: Jest loads its TypeScript configs either with
// Node's native type stripping (Node >= 22.18, e.g. the dev image) or through
// ts-node compiled to CommonJS (older Node, e.g. the CI image). Neither path
// can load a second `.ts` file imported from a `.ts` config in this
// `"type": "module"` package, but both can load a `.cjs` module. Its types
// live in `jest.base.d.cts`.
//
// Jest itself always runs as CommonJS regardless of this package's
// "type": "module" — `@swc/jest` compiles each test/source `.ts` file to
// CommonJS for Jest's runtime (NestJS's own recommended Jest/SWC setup;
// unlike `ts-jest`, it isn't affected by `tsconfig.json`'s NodeNext module
// setting or by `package.json`'s "type": "module"), and `moduleNameMapper`
// strips the explicit `.js` extensions our NodeNext-style source imports
// use (e.g. `./auth.service.js`) so Jest resolves them back to the `.ts`
// source files.

/** @type {import('jest').Config} */
const baseConfig = {
  rootDir: 'src',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
          target: 'es2022',
        },
        module: { type: 'commonjs' },
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};

module.exports = baseConfig;
