# Proposal: scan-in roster (NFC cards → teams → linked match)

Status: **built**. The current rules are in `hardware-api.md` §Scan-in and `firmware/openapi.yaml` in office-rivals/mmr-hardware; this file keeps the reasoning and decisions (other docs link here). Once agreed, it moves into `hardware-api.md` and this file
goes away.

## Flow

1. Players tap their cards on the scoreboard. Each scan adds the player to the table's **roster**,
   the line-up of the next match.
2. An unknown card puts a QR code on the board. A player opens `/t/{code}`, signs in, and taps "Link
   this card to me". The card is then linked, and the player joins the roster.
3. When the roster is full (2 × the league's team size), **Generate teams** splits it by MMR using
   today's `BalanceTeams`. The result becomes the table's **linked match**, exactly as
   `link-table` creates one today: sides, `swap_sides`, scorer, confirm and submit work unchanged.
4. Until the first goal, the roster can still change: scanning, removing or regenerating rebuilds the
   0:0 linked match. After the first goal it is locked until the match ends.

## Data model (one migration)

| Table | Columns | Notes |
|-------|---------|-------|
| `player_cards` | id, organization_id, organization_membership_id (FK, cascade), uid_hmac `bytea(32)`, created_at | Unique on `(organization_id, uid_hmac)`. A member can have several cards. |
| `card_link_requests` | id, organization_id, table_id, uid_hmac, short_code, expires_at, created_at | Created by an unknown-card scan. At most one per table (a new unknown scan replaces it). Deleted when it is used or 10 min after it was created (swept by the existing timeout background service). |
| `table_roster_entries` | id, table_id, organization_membership_id, joined_at | Unique on `(table_id, membership)`. Join order = `joined_at`. Deleted when the match ends, on clear, or after 30 min with no roster activity. |

- **Card ID storage:** `uid_hmac = HMAC-SHA256(key, orgId ‖ normalised uid bytes)`.
  - The key is new config, `Hardware:CardUidKey`, from env or Key Vault and never in the repo.
  - Including the org ID means the same badge can't be matched across orgs, even from a database dump.
  - When the key is unset, scans answer `unavailable`.
  - Raw UIDs are never stored or logged. They travel in the request body, which HTTP logging doesn't
    record (it logs only method, path, query, status and duration).
  - Rotating the key unlinks every card; each player re-links with one scan. Key versioning can wait
    until a rotation actually happens.
- **Members, not league players:** cards and roster entries point at the *membership*, so a card
  works in every league. The roster's league is the table's `DefaultLeagueId`. Generate teams
  get-or-creates the `LeaguePlayer`s through the existing `GetOrCreateLeaguePlayerAsync` path.
- **Not stored:** no scan history, no last-used time, no card label. A scan changes only the roster,
  and the roster is temporary.

## Reuse

- Move `V3PendingMatchCoordinator.BalanceTeams` into an `internal static` helper, unchanged, and
  call it from both places. Note that it is deterministic (a snake draft by MMR), so regenerating the
  same roster gives the same teams. If ux wants "shuffle", that is a new option, not a reroll.
- Add `IV3MatchMakingService.CreateActiveMatchAsync(orgId, leagueId, teams)`. It builds a
  `V3PendingMatch` that is already `Accepted` (with accepted acceptances), then calls the existing
  `PromotePendingMatchToActiveMatch`. That also takes the players out of the matchmaking queue.
  `TableMatchService` then links the match with the same code as `LinkActiveMatchAsync`
  (`TeamIndexAtEndA = 0`).
- Players already in another live active match are refused (`busy`).

## Device API (`openapi.yaml`, firmware to own)

New action types on the existing `POST devices/{id}/actions`:

| type | body | effect |
|------|------|--------|
| `scan` | `uid`: hex, 8/14/20 chars (4/7/10-byte UID), any case | Adds the card's player to the roster. `expected_version` is ignored: a tap is a fact, not an edit. |
| `remove_player` | `player_id` | Removes one player from the roster. |
| `clear_roster` | – | Clears the roster and any 0:0 linked match. |
| `generate_teams` | – | Needs exactly 2 × team size players → linked match. |

The `scan` response adds `scan: { result, player? }`. `result` is one of:

- `joined`
- `already_in`
- `unknown_card`
- `roster_full`
- `locked` (the match has started)
- `busy` (the player is in another live match)
- `no_league` (the table's league has more than 2 players a side)
- `unavailable` (no `Hardware:CardUidKey` configured)

The board uses `result` for a short toast. Everything that has to survive a redraw goes in the state.

New state field, present whenever the table has no started match:

```text
roster: {
  league_name, team_size,
  players: [{ id, name, color }],      // join order
  can_generate: bool,
  link: { url, expires_in_s } | null   // unknown-card QR (<base>/t/<code>)
} | null
```

`ScoreboardPlayer` also gains `color`, so a player keeps their colour in the match teams.

## Colour

- `color` is a **palette index 0–7**. The app API returns the hex value as well.
- The index comes from the membership ID: the first byte of `SHA-256(membershipId)` mod 8. That is
  stable across leagues and .NET versions, unlike `GetHashCode`.
- On a clash within one roster, the later joiner takes the next free index. Four players never
  share a colour, and the same group always gets the same colours.
- When MMR adds a profile colour, that value replaces the hash.
- ⚠️ **The scoreboard is B/W e-paper** (INTERFACES §8), so "colour" can't be shown there as-is.
  ux and firmware need to decide whether the board maps the index to a fill pattern or icon, or
  whether colour is app-only.

## App API (camelCase, Clerk)

| Method | Path | Who | |
|--------|------|-----|--|
| GET | `/short-links/{code}` | member | Existing. Gains `kind: "card"` → `{ kind, orgSlug, tableName, expiresAt }`. |
| POST | `/organizations/{orgId}/me/cards` | member | `{ code }` → 201 `PlayerCardResponse { id, createdAt }`. Uses up the request and adds the caller to that table's roster if it is still open. 409 if the card is already linked; 410 if the code expired. |
| GET | `/organizations/{orgId}/me/cards` | member | `PlayerCardResponse[]` |
| DELETE | `/organizations/{orgId}/me/cards/{cardId}` | member | 204 |
| GET | `/organizations/{orgId}/admin/cards?membershipId=` | Mod | `{ id, membershipId, displayName, createdAt }[]` |
| DELETE | `/organizations/{orgId}/admin/cards/{cardId}` | Mod | 204 |
| DELETE | `/organizations/{orgId}/admin/cards` | Owner | Deletes all cards in the org. |
| — | `LiveTableResponse` | | Gains `roster` (same shape, camelCase, `color` + `colorHex`). |

Optional and cheap, for players who forgot their card: `POST tables/{tableId}/roster/me` and
`DELETE tables/{tableId}/roster/me`.

## frontend-beta (admin-ui)

- **Link** (`/t/{code}`, kind `card`): the page reads "Link this card to you in `<org>`. Tap it on any
  scoreboard to join the next game". The **Link to me** button calls `POST me/cards`, and on success the page
  shows "You're on the roster" plus a link to the profile.
  - A signed-out visitor goes through login, which returns to the page (already built).
  - A non-member sees the same 404 as other short links.
  - An expired code shows "Scan the card again".
- **Profile → Cards:** a list ("Card added 3 Oct") with Remove buttons.
- **Admin → Members → member:** shows the member's cards with Remove buttons.
- **Admin → Hardware:** shows "N cards linked" and a **Delete all cards** button (Owner).

## Privacy

- **Minimum data:**
  - A keyed hash per card plus the member it belongs to.
  - The pending link request: hash, table and code, gone within 10 min.
  - Roster entries: gone when the match ends or after 30 min idle.
  - No scan log is kept. The rated match keeps its players, as it does today.
- **Deletion:**
  - Players delete their own cards, and admins delete one card or all of them.
  - Removing a member (`RemoveMemberAsync`, which only sets status to Removed today) also hard-deletes
    their cards and roster entries.
  - Deleting the org deletes everything through the cascade.
- **The UID is an identifier, not proof:** MIFARE UIDs can be cloned. A cloned card can at most put
  that person in a roster. Because scoreboard confirm submits linked matches without a participant
  check (today's behaviour), that could put someone in a rated match. This is the same trust level
  the board already has. A per-player "approve table matches" step can be added if it becomes a
  problem.
- Logs and traces record the scan `result` only, never the UID or the hash.

## Decisions (lead, 2026-10-15)

1. Colour is shown by the scoreboard's 4 RGB LEDs, one per roster slot. The e-paper shows names only,
   and the app shows the hex value. The palette stays at 8 hues, pending electronics/ux confirming
   they can be told apart on the LEDs.
2. Second tap: probably a no-op (`already_in`). ux decides.
3. Joining from the app without a card: out of scope.
4. Rosters smaller than 2 × team size: no.

**Built:** the card registry and its key, card short links, `/me/cards`, admin cards, card deletion
when a member is removed, `TeamBalancer`, and `CreateActiveMatchAsync` (see `hardware-api.md` §Cards).
**Then (after ux's flow):** the device actions, roster state and table, 6 colours, rematch, discard to teams.

**Device contract = `firmware/openapi.yaml` in office-rivals/mmr-hardware** (firmware's roster draft). It overrides the
Device API section above where they differ:
- The path is the existing `POST devices/{id}/scoreboard/actions`.
- `scan` always answers 200 with the state plus `scan { result, player? }`, never 409.
  `expected_version` is ignored for scans.
- `generate_teams` answers 422 while `can_generate` is false.
- `uid` is 8, 14 or 20 hex characters.
- `color` is a palette index 0–7; the hex value is app-only.
- `roster.players` has at most 4 entries. `roster.link.url` is at most 120 characters (same rules as
  `claim_url`).
