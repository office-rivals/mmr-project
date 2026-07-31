---
"frontend": patch
---

Player pickers are keyboard-navigable: arrow keys move through the suggestions,
Enter picks the highlighted one (or the top match), Escape closes the list. Enter
in a player filter no longer submits the match form with empty slots. Both
pickers now use the `bits-ui` Combobox primitive instead of a hand-rolled list,
so they get listbox/option semantics for free.
