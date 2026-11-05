# Game invites in the beta frontend

Status: implemented locally and reviewed. Authenticated end-to-end verification still requires local service configuration; see [validation](game-invites-validation.md).

## Confirmed decisions

- Create a game invite from the Play tab using the currently selected league.
- The creator automatically occupies a spot. Capacity comes from the league's required player count.
- Joining means being ready to play when the invite fills; there is no scheduled start time in the first version.
- Invites are discoverable through shared links only, with no public list of open games. Links can be forwarded, including through a group chat.
- Invite participants form their own group, independent of the normal matchmaking queue. Queue players do not fill invite spots, and invite participants are not selected for other queue games while waiting.
- Creating or joining requires signing in and already belonging to the organization and league. Organization admission remains a separate flow; signing in should return users to the invite they opened.
- Filling the invite generates teams and starts a 30-second acceptance step. Joining the invite does not itself accept that match; the underlying mechanism need not use the existing pending-match system.
- The first version supports the installed PWA, copying links, and native sharing where supported. Background push notifications are outside its scope.
- Any participant may add existing league players on their behalf without those players opening the link; these players occupy real spots. The person who added them may accept or decline for them, and they may also accept individually by opening the app.
- A player can be committed to only one invite, queue, pending match, or active match per league. They must leave the queue before joining an invite; adding another player enforces the same rule.
- While waiting, participants may leave and free their spots. The creator may cancel the invite; the creator leaving also cancels it.
- An unfilled invite expires 30 minutes after creation and releases everyone's spots.
- Invite games use the Play tab's Random teams shuffle, adapted to the league's team size, and the same rating updates as normal matchmaking. Players added together are not guaranteed to be teammates.
- Multiple groups in the same league may fill and begin acceptance independently, without blocking each other.
- While waiting, the creator may remove any participant. Other participants may remove themselves or players they added, but not unrelated players. The roster locks when acceptance begins.
- If someone declines or misses acceptance, reopen the invite with the accepted players and remove those who declined or timed out. Keep the original link and expiration; replacements trigger new teams and a fresh acceptance step. A creator decline or timeout cancels the invite.
- Play shows the current invite, roster, remaining spots, time left, and sharing action. Closing the page does not lose the invite. The shared link opens the same view, with an explicit join action rather than automatic enrollment.
- Existing league players without a linked sign-in account may also be added. The person adding them handles acceptance; no new league membership is created.
- An added player may explicitly take control of their own spot after opening the link. Preserve the spot and acceptance status, and revoke the adding participant's ability to accept, decline, or remove that player. The creator retains normal removal rights.
- An acceptance step that begins before the original invite expiry receives its full 30 seconds. If it fails after the original expiry, the invite expires rather than reopening.
- The first successful signup takes the last spot; later attempts see that the invite is full. There is no waiting list. Adding several players is all-or-nothing if insufficient spots remain.
- Do not introduce a special product policy for league configuration or membership changes. Implementation should enforce only the checks necessary to prevent invalid matches.
- Use the existing matchmaking classification for invite games, with no new match-source category or history distinction.
- Only signed-in members of both the organization and league may see the roster. Logged-out users sign in and return to the link; ineligible users see a membership-required message without the roster or automatic organization admission.
- A participant voluntarily leaving while waiting is prompted whether to also remove the players they added and still manage. They may leave alone and keep those players in the invite, or leave together. Players who have taken control of their own spots are independent. The existing creator-departure cancellation rule remains in place.
- When a participant leaves alone, responsibility for the added players who remain transfers to the creator, including accepting or declining for them. The same transfer applies when their representative is removed or misses acceptance. During acceptance, retain only players whose acceptance succeeded; remove those who declined or timed out. Creator decline or timeout still cancels the whole invite.

## Lifecycle

1. **Waiting:** creation enrolls the creator and makes a shareable link available. Eligible players join or are added until the league's capacity is reached. Participants can leave or be removed under the rules above.
2. **Awaiting acceptance:** lock the roster, shuffle teams using the Play randomization algorithm, and allow 30 seconds for each player's acceptance. A representative may respond for players they manage. Separate invite groups proceed independently.
3. **Active match:** all players accepted. Continue through the existing match result and rating flow, with the existing matchmaking classification. The invite cannot create another game.
4. **Reopened:** a failed acceptance step removes declined or timed-out players, transfers responsibility for represented players who stay, and returns the invite to waiting if its original expiry has not passed. Preserve the link and original expiry. The next full roster gets new teams and a fresh acceptance step.
5. **Ended:** creator cancellation, creator departure, creator decline or timeout, or expiry ends the invite and releases outstanding commitments. An acceptance step that started before expiry may finish successfully after it.

## Implementation responsibilities

These are correctness requirements, not additional product choices or commitments to a particular schema.

- Enforce player eligibility, capacity, representation permissions, and one commitment per player per league on the server, including concurrent attempts through the existing queue.
- Keep multiple-player additions atomic and make retries safe. Concurrent final joins must produce one roster and at most one resulting match.
- Store shared teams before starting acceptance; every participant sees the same draw and deadline. Prevent stale actions from applying to a different acceptance round.
- Preserve confirmed state across refreshes and failures. Recoverable failures must not silently lose players or create duplicate games; the exact retry mechanism is an implementation choice.
- Refresh the invite and acceptance state while open and reconcile it when returning to the app. Background push is outside scope.
- Enforce necessary validity checks if league configuration or membership changes, without adding a separate product policy for those changes.
- Reuse the normal result-submission and rating behavior. Proxy acceptance and independent invite readiness require backend support beyond the beta UI.

## Decision record

See [Game invites own their roster](../adr/0001-game-invites-own-their-roster.md).

## Existing behavior relevant to implementation

These are current constraints, not accepted restrictions for the new feature.

- League capacity is twice its team size; games currently have two teams.
- Pending matches already have teams and require acceptance before becoming active.
- The database currently restricts each league to one pending-status match.
- Queue team generation currently uses ratings and a snake draft in the API coordinator.
- The beta Play tab's Random teams flow instead uses a client-side Fisher–Yates shuffle without rating input. Invites will use this randomization behavior rather than queue balancing.
- Existing invitation links admit organization members and do not arrange games.

See the root [glossary](../../GLOSSARY.md) for the agreed domain terminology.
