---
"api": patch
---

Fix match deletion failing for any match that has been flagged. `DeleteMatchAsync` now removes the match's `match_flags` rows inside the same transaction before deleting the match, so the restricted `fk_match_flags_match` foreign key no longer blocks the delete.
