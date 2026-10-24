# frontend-beta

## Interactive controls

Build interactive controls from `src/components/ui` (shadcn on Base UI). Base UI
carries their pointer, focus, keyboard and touch handling, which is where the
beta's earlier per-control code broke on iOS.

- **A control `components/ui` lacks:** add it with `npx shadcn add <name>`, then
  diff `components/ui`. `add` overwrites the files the new component depends on,
  such as `button.tsx` and `input.tsx`. Restore ours and restyle the new file to
  match them.
- **A form that posts without JavaScript** (see "Native form responses" in the
  README): Base UI controls can't be operated until the page hydrates, so use
  `NativeSelect` and native radios there.
