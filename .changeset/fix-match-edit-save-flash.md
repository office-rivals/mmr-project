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
while one is in flight, and a response no longer closes or writes an error into
a dialog the admin cancelled and reopened while it was outstanding.

Cancelling a save and reopening the same match no longer shows the scores from
before that save, which the next Save would then write back over the edit that
had just landed. The dialog re-reads the match from the reloaded data, as long
as nothing has been typed into it.

A save the admin cancelled out of is still reported: a rejected edit in that
window used to be dropped silently, and a successful one left the previous
attempt's failure banner standing. An outstanding save also no longer disables
Save on a different match, and correcting a rejected edit clears the old error
as soon as the retry starts.
