# @enagar/config

Shared **ESLint**, **TypeScript**, and **Tailwind** presets for the eNagarSeba monorepo.

## Why this exists

Without a single source of truth, `tsconfig.json` and `.eslintrc.json` drift across apps. This package pins the rules once.

## Exports

| Path                                        | Purpose                                                   |
| ------------------------------------------- | --------------------------------------------------------- |
| `@enagar/config/eslint/base`                | TS + import + correctness rules                           |
| `@enagar/config/eslint/node`                | + Node env (NestJS API, workers)                          |
| `@enagar/config/eslint/next`                | + React, hooks, jsx-a11y, Next core-web-vitals            |
| `@enagar/config/eslint/react-native`        | + React, hooks (RN-suitable)                              |
| `@enagar/config/tsconfig/base.json`         | Strict TS baseline — self-contained, `${configDir}`-aware |
| `@enagar/config/tsconfig/node.json`         | + NodeNext, decorators (NestJS)                           |
| `@enagar/config/tsconfig/next.json`         | + JSX preserve, bundler resolution                        |
| `@enagar/config/tsconfig/react-native.json` | + RN JSX                                                  |
| `@enagar/config/tailwind/base`              | Brand-CSS-var-driven Tailwind preset                      |

## Usage

### ESLint — must be `.eslintrc.cjs` (not `.json`)

ESLint 8's legacy resolver mangles scoped extends paths (`@enagar/config/eslint/node` → `@enagar/eslint-config-config/eslint/node`, which doesn't exist). Use `require.resolve` from a CJS config to bypass it:

```js
// apps/api/.eslintrc.cjs
module.exports = {
  extends: [require.resolve('@enagar/config/eslint/node')],
  parserOptions: { project: './tsconfig.json', tsconfigRootDir: __dirname },
};
```

### TypeScript — string extends works as expected

`tsc` honours `package.json` exports natively:

```jsonc
// apps/api/tsconfig.json
{ "extends": "@enagar/config/tsconfig/node.json", "include": ["src"] }
```

The shared base uses `${configDir}` (TS 5.5+) so `rootDir` / `outDir` resolve relative to the _consuming_ file, not this package.

### Tailwind — preset import

```ts
// apps/citizen-pwa/tailwind.config.ts
import preset from '@enagar/config/tailwind/base';
export default { presets: [preset], content: ['./app/**/*.tsx'] };
```
