# frontend

## Interactive controls

Build interactive controls from `src/components/ui` (shadcn on Base UI). Base UI
carries their pointer, focus, keyboard and touch handling, which is where the
app's earlier per-control code broke on iOS.

- **A control `components/ui` lacks:** add it with `npx shadcn add <name>`, then
  diff `components/ui`. `add` overwrites the files the new component depends on,
  such as `button.tsx` and `input.tsx`. Restore ours and restyle the new file to
  match them.
- **A form that posts without JavaScript** (see "Native form responses" in the
  README): Base UI controls can't be operated until the page hydrates, so use
  `NativeSelect` and native radios there.

## Server functions and server routes

Screen-specific data belongs here, not in the API: a server function or server
route calls the API's general endpoints, then joins and shapes the answers for
one screen. If a screen needs something the API can't answer, add a general
resource to the API and shape it here. See "General API, screen-specific
endpoints" in the root [AGENTS.md](../AGENTS.md).
