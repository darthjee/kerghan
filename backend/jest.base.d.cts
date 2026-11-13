import type { Config } from 'jest';

/** Jest settings shared by `jest.config.ts` and `jest.db.config.ts` (see `jest.base.cjs`). */
declare const baseConfig: Config;

export = baseConfig;
