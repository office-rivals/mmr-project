---
title: Foosball tables
description: Connect goal counters and scoreboards to a table, watch the live score, and turn a scored game into a rated match.
---

A foosball table can carry two **goal counters** (one in each goal) and a **scoreboard**. The goal counters report every goal to the API, which keeps the score; the scoreboard shows it. People can walk up and play without signing in to anything: the table records an **unclaimed match** (a score with no players), and the players claim it in the app afterwards.

The beta's pages are in [`frontend-beta/src/routes/admin/$orgSlug/hardware.tsx`](https://github.com/office-rivals/mmr-project/blob/main/frontend-beta/src/routes/admin/$orgSlug/hardware.tsx) and [`frontend-beta/src/routes/_authed/$orgSlug/$leagueSlug/tables/`](https://github.com/office-rivals/mmr-project/tree/main/frontend-beta/src/routes/_authed/$orgSlug/$leagueSlug/tables), with shared code in [`frontend-beta/src/features/foosball/`](https://github.com/office-rivals/mmr-project/tree/main/frontend-beta/src/features/foosball).

## Setting up a table

Owners and moderators do this at `/admin/<org>/hardware`.

1. **New table**: give it a name, its **league**, and its two **team names**. The table, its devices and every game played on it belong to that league; the Hardware page shows it on each table. You can move a table to another league only while no game is live or waiting to be claimed; matches already saved stay in the league they were rated in. Team names are what players call the teams when nobody's signed in, usually the colour of the figures. They default to *Red* and *White* and must differ. Each team's goal belongs to the team whose goalkeeper guards it. **Table sound** sets how loud the table's devices play their sounds (the scoreboard's goal, win and undo sounds, and the goal counters' beeps): *Off*, *Low*, *Medium* (the default) or *High*. The devices pick up the change by themselves, so nobody has to touch the table.
2. **Power on the devices.** A new device enrols into the organization and appears under **Unclaimed devices**. A scoreboard shows its ID (`fb-` followed by 12 hex digits) on screen; goal counters have no screen, so the list puts the device that checked in most recently at the top.
3. **Claim** each device: choose the table and the role. For a goal counter, answer **Whose goalkeeper guards this goal?** with one of the table's team names; the line under it says the result, for example *A ball in this goal is a goal for White.* The device list then shows *Table 1 · guarded by Red · counts for White · end A*; the end letter matches the counter's debug screen (*End A*). Each goal can have one counter. For a scoreboard, choose the end it sits on.

Each table shows its full short link (`https://<host>/t/` followed by a code) with a copy button. The code is random (10 characters) unless you pick a readable one: under **New link**, type a code such as `table1` (3–32 lowercase letters, digits or dashes), or leave it empty for a new random one. A code that's already in use is refused. Write it to an NFC sticker on the table, or print it as a QR code with any QR generator, so players open the claim screen straight from their phone. The scoreboard shows its own QR code after a game that still needs claiming. The table link never expires and opens whatever fits the table's latest game: the live score while a game is on, the claim screen when a finished game still needs players, or the match page once it's rated. **New link** replaces it, and the old link stops working, so re-write the sticker afterwards.

Each table on the page lists its devices with battery voltage, a low-battery warning, when the device was last seen and its firmware version. Goal counters with beam-health firmware also show the beam's state: *Beam OK*, *Beam weak* (clean or realign it), *Too much light* (shade the drawer), *Beam blocked* (empty the drawer) or *Beam sensor dead*, with the last light readings and when it was checked. **Beam settings** on a goal counter picks its beam mode: *A* (the default), *A+* (a brighter LED for weak optics), *B* (daylight, which costs battery while it is on) or *Auto*. Under **Advanced** are the fitted resistor values and the health thresholds; an empty field uses the firmware default. The device picks up a change at its next wake. When `GRAFANA_URL` is [configured](/configuration/environment-variables/), **Light by hour of day** opens the goal counter's light readings over the day in Grafana, to see when sunlight reaches the drawer. A device that needs attention carries a chip saying why: *Wrong firmware*, *Silent for over 36 h* (it should check in at least daily), *Battery low* or *Battery empty*, or a beam state other than *Beam OK*. The table's card shows *1 device needs attention* (amber, or red when a device has stopped counting), and the organization's admin overview lists every such device with what to do and a link to it. **Reset** returns a device to the unclaimed list, for example after it has been wiped or moved to another table. The page also lists each table's unclaimed matches. **Unmatched goals** lists goals the server received but couldn't count towards any game (from an unassigned device, a device tagged with another table, or a late goal that fits no game). A steady stream of them usually means a device is assigned wrongly.

Devices enrol with the organization's **enrolment token**. Only owners can create, replace or revoke it, and a new token is shown once. Replacing or revoking it stops new devices enrolling with the old token; devices that have already enrolled keep working.

**Badges** lists the badges members have linked, by member, with **Remove** for a lost badge. Owners can also **Delete all badges**, after which every member has to link theirs again. Removing a member from the organization deletes their badges too.

## Playing

`/<org>/<league>/tables` lists the league's tables. A table opened from another league's address moves to its own league. Each table's page is the live score, made to be read on a phone at the table, with or without a scoreboard. Tap the table's sticker (its `/t/<code>` link) to open it while a game is on or has just finished.

- **The score** updates within a second of a goal. Each column is a team, under the table's team name (*Red* and *White* by default), or its players' names once they're known. On a table with a scoreboard the columns follow the scoreboard's order; without one, the first team is on the left. A goal makes the scoring team's number pulse once. When the game is won, the winner gets a check mark.
- **Under the score:** *First to 10 · 7 min* during a game, *Game over · saving in 6 s* while a matchmade game is about to be rated, and the last goal, for example *Goal for White · 20 s ago · Anna*. When the game is won it reads *Game over · Red won*. After an undo at the table (a goal counter's undo button or the scoreboard), it reads *Goal for White undone · now 2 : 3* for a few seconds.
- **New game** asks whether to *Save* the game (so it can be claimed and rated) or *Throw it away*. If the score changed in the meantime, nothing happens and you're asked to check it. Goals are undone at the table, not from the phone.
- The phone's screen stays on during a game. If the page loses its connection, the score greys out and *Reconnecting…* shows, so a stale score never looks live.
- When a goal counter is offline, its battery is low or a ball is stuck in its drawer, a line at the bottom says so, for example *Goal counter behind the Red goalkeeper: battery low* or *Ball stuck behind the White goalkeeper?*

Between games the page also shows who has scanned in with a badge, each in their colour (the same colour the scoreboard's lights use).

**Is a table free?** Each table on the list, on its own page and on the admin **Hardware** page carries a badge. The list refreshes every 15 seconds, so you can check it before walking over. The server works it out from the live game, scanned-in players and whether the table's devices are awake:

- *In use since 10:42* (with the score once someone has scored), *Gathering: 2 of 4* while players scan in, or *Teams made*.
- *Probably in use since 10:42*: only the devices say so, for example the scoreboard has been kept awake for a while, or a game has paused for a few minutes.
- *Just finished 10–7 · free soon*, for 3 minutes after the last goal.
- *Free*. A device woken by someone bumping the table doesn't count; a faint dot shows that someone's nearby.
- *Status unknown*, with *no goal counter*, *battery low* or *devices offline*: the table can't tell, so it is never shown as free.

**Table stats.** **Stats** on a table's page (`/<org>/<league>/tables/<table>/stats`) shows the last 8 weeks (or 4 or 12), in your own time zone: games played, games per week, how long a game typically takes, and how much of office hours (Mon–Fri 08:00–18:00) the table is in use. Below that are games per day (rated and unclaimed), a weekly list and a heatmap of the busiest hours. A number based on too few games is greyed out with *Not enough games yet*. Until the server records device wake times, time in use only counts the time around goals, so it's shown as a minimum (*≥ 23%*). Moderators and owners also see the claim rate, whether one end scores more than the other, and data-quality numbers per device.

**Claiming a match.** Scan the scoreboard's QR code or tap the table's NFC sticker (its permanent `/t/<code>` link). While a finished game still needs players, both open **Submit match** for that table (`/<org>/<league>/submit?table=<table>&match=<match>`). If you aren't signed in, you sign in first and then land on the same screen. The **Submit match** page also shows a banner for every match waiting for players, for example *Table 1: Red 10–7 White, who played?*

The screen shows the table's score, which you can't edit, and asks who played. Put each player under their team (*Red team*, *White team*):

- Tap a name under a score to add that player: **Me** first, then the people you recently played with.
- **Same players as last game** fills in the previous line-up at this table, and the swap button switches the two teams.
- Anyone else can be searched for or added as a new player, as on the submit page.

The number of players per team follows the league's format (1v1 or 2v2). **Save match** records it as a normal rated match in the table's league; a table from another league can't be claimed there. If the match has already been saved, or is older than the claim window (7 days by default), the page says so and shows the normal submit form instead.

**Matchmade games.** If you are playing a match that matchmaking already created, link it to the table from the table's page. Goals then count towards that match, and the scoreboard shows the players' names.

**Goals and scorers.** A match scored on a table has a match page (`/<org>/<league>/match/<match>`) that lists its goals: the time since the first goal, the score after it, and who scored. Players of the match and moderators can set, fix or clear each goal's scorer, for example after a game claimed in the app, where nobody picked scorers on the scoreboard. Picking a player of the other team records an own goal, shown as *Oops, own goal by …*. The score never changes, as on the scoreboard.

## Badges

Members can tap an NFC badge (for example an office access card) on a table's scoreboard to join the game. The first time a badge is tapped, the scoreboard shows a QR code. Scanning it opens **My badges** (`/<org>/cards`), which names the table and asks whose badge it is: **This is my badge**, or **It's someone else's**, then search for the player. One more tap confirms (*Link this badge to Alice?*). Nothing is linked before that tap. Whoever the badge is linked to plays as that person, so link someone else's badge only for them, for example when they forgot their phone. Badges linked by someone else show *linked by …* in **My badges** and in the admin list, and the owner can remove them. The code works for 10 minutes; after that, tap the badge again for a new one. Linking also scans the badge's owner in at that table, and the page says whether they joined the game, were already in, or couldn't join (the game is full or already running, they're playing at another table, or the table has no league). A badge can belong to only one member, so a badge someone else already linked has to be removed by an admin first.

**My badges** is also in the settings menu. It lists your badges in the organization, and **Remove** unlinks one. The server stores only a keyed hash of each badge, never its number.
