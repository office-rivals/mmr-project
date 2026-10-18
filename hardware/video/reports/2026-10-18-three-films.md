# Three new films (lead ACTION, 2026-10-18): player flow, admin flow, PR walkthrough

English only, not published, nothing committed. All decode cleanly (`ffmpeg -xerror`), 1920x1080, `hyperframes check` passed.

| File | Length | Loudness | What |
|---|---|---|---|
| `video/player-flow.mp4` | 55.4 s | −16 LUFS | A phone taps the table's sticker → live score → a goal (the counter's real chirp, the column pulse) → "20 s ago" → the counter's own undo (key held 1 s, shown on a goal-counter inset) → phone undo → New game sheet → first to ten → saving → saved → Table 2 "Who played?" → rated. One short caption per step, a quiet bed. |
| `video/admin-flow.mp4` | 75.8 s | −18 LUFS | Hardware: an unclaimed counter → "Whose goalkeeper guards this goal?" (zoom) → the "already guarded" error → claim on Table 3 → team-name clash (zoom) → the overview's attention banner → device health rows → beam settings → Table sound → unclaimed matches (zoom). |
| `video/pr-walkthrough.mp4` / `-cc.mp4` + `pr-walkthrough.en.srt` | 6:36 | −13 LUFS | Narrated (Kokoro) review guide in 8 scenes: the four PRs; the device → API → phone flow and both undos; PR 1 api (auth, endpoints + codes, undo refusals, long-poll, MutateTableAsync, background services, migration, seed, tests, where to start); PR 2 frontend (live view, polling, error copy, admin Hardware, health, claiming, tests incl. "no Playwright spec yet", where to start); PR 3 hardware (lib/core, detector, persist-then-beep, undo key, twin, sled CAD, assembly gate, tests); PR 4 observability; review notes (scoreboard still in the API/frontend, long changesets, the 2 s long-poll fallback). -cc = clean picture + soft English subtitles. |

Sources:
- Flows: admin-ui's render harness, true 2x frame sequences (mock data = the API seed: Example Org, /acme, Table 1–3, first names only); cues and sound from its step JSON (`video/flows/tools/build.py`).
- Walkthrough: code panels read verbatim from the working tree (`video/pr-walkthrough/tools/excerpts.py`, anchored, re-run on every build); test counts cite INTERFACES §0 (firmware native 55 · contract 30 · API 293 · twin 19 · gate 139); 46 Vitest and 53 API hardware tests counted from the tree; screens from admin-ui's harness and observability/screenshots (twin data).
- Public repo: placeholders only. The research also listed private details in team docs (a first name, an employer, local paths, table photos); none appear in any film.

Rebuild (from `video/film`): `sh tools/build.sh player|admin|pr`.
Not done: no music bed choice was asked for, so the flows use the house pizzicato bed quietly; the player flow is 55 s (lead's range was ~60–90 s), which is the recording's length plus intro and end card.

## Final for the PRs (2026-10-18 20:25): league binding, no phone undo, fixed slides

| File | Length | Size |
|---|---|---|
| `video/player-flow.mp4` | 52.5 s | 7.1 MB |
| `video/admin-flow.mp4` | 74.7 s | 10.7 MB |
| `video/pr-walkthrough.mp4` | 6:58 | 50.9 MB |
| `video/pr-walkthrough-cc.mp4` (soft English subtitles) | 6:58 | 43.5 MB |

All decode (`ffmpeg -xerror`), `hyperframes check` passed for each. Changes since the first cut:
- Phone undo removed (user): the player flow's Undo step is gone; the walkthrough says undo comes only from the counter's key; the
  diagram's phone-undo path is gone; the New-game excerpt is read from the table page.
- League binding: a new walkthrough line + `HardwareAdminService.ApplyAsync` excerpt (one league per table; another league → 400;
  move only when idle → 409); the migration slide lists `foosball_tables.league_id`; the claim slide uses the cross-league shot;
  the admin flow shows the League field (zoom + caption "One league, two different team names.").
- Test counts: API 294 (§0), of which 57 hardware tests as the runner counts; 45 Vitest + 7 Playwright e2e (the new
  `frontend-beta/e2e/foosball-tables.e2e.spec.ts`), replacing "no Playwright spec".
- Layout: the "where to start" slides (badge column + full paths) incl. a new PR 4 slide; diagram labels; crossfades.
- Checked: stills every 5 s over the whole walkthrough (composition and the rendered file), plus the zooms in the admin flow.
