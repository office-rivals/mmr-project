---
"frontend": patch
---

Force a clean Vite dependency pre-bundle (`optimizeDeps.force`) when the dev
server runs under the Aspire AppHost, so esbuild doesn't re-optimize dependencies
mid-request and crash with `write EPIPE` on the first page load. A standalone
`npm run dev` is unaffected and keeps its dependency cache.
