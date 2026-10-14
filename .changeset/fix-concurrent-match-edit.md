---
"api": patch
---

Fix overlapping edits of the same match returning a 500 for an edit that had actually saved; edits of one match now apply one at a time.
