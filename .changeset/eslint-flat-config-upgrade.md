---
'frontend': patch
---

Upgrade frontend ESLint stack: ESLint 8 → 10, eslint-plugin-svelte 2 → 3,
typescript-eslint 7 → 8 (unified package), eslint-config-prettier 9 → 10.
Migrate from `.eslintrc.cjs` legacy config to flat `eslint.config.js`. Drop
`@types/eslint` (now built in) and `.eslintignore` (replaced by `ignores` in
flat config). New strict defaults from eslint-plugin-svelte v3
(`require-each-key`, `no-navigation-without-resolve`,
`prefer-svelte-reactivity`) are reported as warnings to be addressed
incrementally.
