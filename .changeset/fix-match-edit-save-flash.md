---
"frontend": patch
---

Fix the admin match edit dialog flashing "Each player can only appear once
across both teams" over a save that succeeded. Resetting the form on success
dropped every player dropdown to its first option and blanked the scores, and
Svelte syncs bound state back from a reset form, so the dialog rendered that
bogus state until the follow-up data reload finished. The dialog owns those
values, so it no longer resets the form.

Saving twice for the same match no longer sends two requests: Save is ignored
while one is in flight, and a response is dropped if the admin cancelled and
reopened the dialog while it was outstanding.
