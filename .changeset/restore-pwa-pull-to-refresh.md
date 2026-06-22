---
"frontend": patch
---

Restore pull-to-refresh in the installed PWA. The gesture was silently dropped
during the v3 multi-tenancy migration, which rewrote the authenticated layout
and never re-mounted the `PullToRefresh` component. It is wired back into the
`(authed)` shell, and the refresh indicator now slides out from beneath the
fixed app-shell header instead of appearing behind it.
