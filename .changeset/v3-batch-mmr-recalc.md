---
"api": patch
---

Restore batch MMR endpoint usage in v3 season recalculations. v3 had regressed to one HTTP call per match; this rebuilds the chunk into a single batch request and aborts the recalc if the response count doesn't match, preventing half-applied recalculations.
