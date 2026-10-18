# Brief: admin-ui

You are `admin-ui`. Read first: `team/PROTOCOL.md`, `team/DECISIONS.md` (last two sections),
`team/INTERFACES.md` §8 and §11, `ux/SCOREBOARD-UI.md` (for tone), and the repo's `../CLAUDE.md`
(public repo; `docs/` documents frontend-beta and must be updated for user-visible changes; changesets).
You work in the parent repo's `frontend-beta/` (React + TanStack Router).

## Goal
The user-facing side of the foosball hardware in **frontend-beta**, kept **isolated** from the rest of
that fast-moving codebase (own route subtree + own feature folder; touch shared files only for a nav link
and route registration):
1. **Admin** (extend the existing `routes/admin/$orgSlug/...` area, Moderator/Owner):
   tables (create/rename, end labels A/B), devices (unclaimed list → claim → assign table/role/end, reset),
   battery level + low-battery + last seen per device, firmware version; unclaimed matches per table.
2. **Players**: see a table's live score; **claim an unclaimed match** (pick players for end A / end B,
   choose league, submit → normal match); link an active matchmaking match to a table.

## Working with others
- API comes from `backend` — build against their contract; mock it until it lands.
- Ask `ux` for a quick review of the claim flow (it must be fast — players want to be done in seconds).
- Update `docs/` per `docs/README.md` conventions. Add a changeset. No commits.
- Report progress and completion to lead; questions for the user → lead.
