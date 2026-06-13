---
"frontend": patch
---

Force a clean Vite dependency pre-bundle on dev-server startup
(`optimizeDeps.force`) so esbuild doesn't re-optimize dependencies mid-request
and crash with `write EPIPE` on the first page load.
