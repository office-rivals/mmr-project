# Visual parity harness

`npm run parity:visual` from `frontend-beta/` runs the reference and beta against
one freshly seeded e2e stack. Run it alone: the shared functional suite uses the
same database and ports and also reseeds destructively.

The runner uses Playwright from `frontend/node_modules` to share the reference
suite's setup without loading two Playwright installations. Test definitions,
comparison logic, and artifacts belong to `frontend-beta`.

Each scene is captured at 1440×1000 and 390×844. Both browsers use the same Clerk
storage state, en-US locale, UTC timezone, device scale, and reduced-motion
setting. Renewed authentication cookies are carried forward without carrying
scene-specific local storage. The frontend servers use UTC too. Captures wait for fonts, hydration
network activity, and chart rendering; CSS animations and carets are disabled.
Comparisons use pixelmatch with a 0.1 color threshold and zero allowed differing
pixels. Image size differences are included, not cropped away. The only masked region
is the “Accept within …s” countdown sentence in the pending-match dialog; its
expiration clock advances between the two captures. The rest of that dialog
is compared normally.

Artifacts appear in `test-results/visual/<scene>/`:

- `reference.png`: Svelte screenshot
- `beta.png`: React screenshot
- `diff.png`: highlighted differences
- `metrics.json`: dimensions and differing-pixel count

The HTML report embeds these images. Artifacts are gitignored because seeded
sessions can contain the configured test user's identity. Do not commit them.

## Coverage

The scene matrix covers every page route at both widths: organization browsing
and settings, league leaderboards/statistics/profiles, match submission,
matchmaking and active matches, random teams, personal tokens, invitation entry
and valid/invalid invitations, authentication, and all organization/league admin
pages. It also opens the season picker, both header menus, player stats, match
report/reason/flag dialogs, player creation, match editing, flag resolution/edit/deletion, the pending-match
dialog, the active-match score picker/review, and the token,
league, season, and invite-link creation forms. Empty league and admin lists use
explicit fixtures rather than accepting a 404 page as an empty state.

A separate keyboard case verifies season selection. Beta-specific functional
regressions live alongside the visual harness and run with
`npm run e2e:regressions`; they use a separate configuration and fresh seed.

No visual differences have been accepted. A failed comparison is not an
accepted baseline. The HTML report and per-scene metrics record the actual
result of each run.
