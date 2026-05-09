---
'frontend': patch
---

Bump frontend Docker base image to `node:24-alpine` (current Node LTS).
CI workflows now read the Node version from a single root-level `.nvmrc`.
