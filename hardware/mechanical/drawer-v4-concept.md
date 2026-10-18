# Real ball tunnel (2026-10-15 photos) and the v4 concept

Draft for lead. It's based on the photos in `team/drawings/drawer-photos/1..10` and the two slow-motion roll videos
(see 'Photos 6–10 and the roll videos' below §1). Sketch: [`drawer-sketch.svg`](drawer-sketch.svg)
(side, top and end views, with the proposed sled drawn in). **Left and right always mean as seen from the opening,
looking into the tunnel.** Every dimension is in mm. Distances along the tunnel are measured
from the outer face of the black frame.

## 1. What the photos give

| Dimension | Value | ± | Source / how |
|---|---|---|---|
| Frame opening, width | 130 | 3 | Photo 2: the hook sits on the right inner edge and the left inner edge reads 13.0–13.1 (about 103 px/cm at the frame plane) |
| Frame opening, height | 60 | 3 | Photo 1: the hook sits on the bottom inner edge and the top inner edge reads ≈ 6.0 (about 108 px/cm). Lead read 6.2 |
| Opening corner radius | ~10 | 3 | Photos 1, 2, 5 |
| Frame tube + cabinet wall depth | ~35 | 10 | Photos 1 and 5 show a deep black tube; the cabinet wall is 30 (spec) plus the frame flange. Not measured |
| **Floor step at the mouth** | **~10 down** into the frame tube | 4 | Full-res photo 5 (2026-10-15 re-read) + user ("~1 cm step"): the tunnel floor ends at the mouth with a dark front face. The frame tube's floor is lower, and the resting ball sits down in the tube, below the tunnel floor. So the step is vertical, at the floor, about one ball-quarter high (≈ 10–15 by the ball scale). Balls roll off the step and stop against the frame's lip. **Confirm: down, ~10** |
| Roof at the mouth | 3–5 below the opening's top edge | 3 | Photo 5: the roof plate's front edge (with a screwed metal strip) sits just inside the opening's top edge |
| Tunnel interior, height | **~46** | 4 | 60 (opening) − ~10 (floor step) − ~4 (roof). The user's 47–52 fits at the top end of the range. The roll test's 43 fits, but only with ~3 to spare |
| Tunnel interior, width | **unclear: 85–118** (superseded: see 'Photos 6–10 and the roll videos' below) | — | The full-res photos **conflict**. Photo 5 shows thick dark wooden end faces inside the frame on both sides, the left one ~1.4× the right. Measured at the mouth, the clear wood-to-wood width is ~1.45× the clear height, which with a ~46 height gives only ~65–90. But that assumes every edge is at the same depth, and photos 3 and 4 suggest they aren't: a **thick block or inclined board on the LEFT** starts a few cm in and runs to about the entrance (photo 3: from ~7 to ~26 cm along the tape), with a light sloped face (photo 4). The user's earlier "1–1.5 cm less than the frame" (115–120) may be the width past that block. **Must be measured before the roll test is printed** (question A) |
| Frame face → near edge of the goal entrance | 265 | 10 | Photo 3: the tape reads 27–28 at the frame, diagonal and sagging. Taking out its sideways (~60) and downward (~30) runs gives ~265 straight in |
| Frame face → far end wall | 495 | 10 | Photo 4: the tape reads ≈ 49–50 at the frame's bottom edge and runs almost straight to the far end |
| Right wall | a ledge along its foot | ? | Photo 4: a lighter strip along the floor's right edge, maybe a trim strip. If it's ≥ 5 high, the right skin and queue need to clear it (question B) |
| Floor | bare wood (user, DECISIONS); felt only behind the goal entrance | — | Photos 4 and 5 look fibrous (MDF/chipboard?), so question 9 confirms it. Designed for wood; the hold-in also works on felt |
| Roof | flat plate from the mouth to the entrance | — | Photo 5: a plate over the near part of the tunnel with a metal bracket/flap near its far edge. Light comes in beyond it (photo 3) = the entrance opening |
| Where balls rest | in the frame tube, lower **right** corner | — | Photos 2 and 5: the ball sits at the frame's lower right corner, so the floor falls toward the opening |
| Cross-slope | floor falls toward the **right** wall | ? | User + photos 2/5 (DECISIONS 2026-10-15). Amount unknown: question 11 |

**Can't be read from the photos (2026-10-15 re-read at full resolution):** the clear width (it hinges on the left block),
the left block's extent, the floor slopes, the entrance's length and position across, the right-wall ledge's height,
and the rebound. The rest is in the table above with its uncertainty.

**What the re-read changes:**
- **Queue start and sled position:** the first ball now sits down in the frame tube, below a ~10 step. The queue
  starts in the tube, and the sled's front face stops at the mouth, on the tunnel floor behind the step, where the
  concept already had it (36). The step face makes a natural in-stop. The queue length barely changes: ball 1 in the
  tube, then 3 more on the tunnel floor, so 4 balls end ~145 from the frame face and the beam stays at ~240.
- **Roll-test print (110 × 43):** the height fits with ~3 to spare. **The width may not fit if the left block narrows
  the tunnel near the mouth.** Don't print it until question A is answered. If the clear width is < 115, `W` in
  `roll_test.py` drops to (clear width − 5) and the block, V-wall and gate follow. Below ~95, the sled concept itself
  needs rework: there's no room for the flat 3×AA (48 wide) beside a 40 channel + pod.
- **Rebound:** a step down at the frame makes the first ball's stop softer (it drops into the tube) but gives the next
  ball a ledge to bounce off. Question 13 still measures it.

### Photos 6–10 and the roll videos (2026-10-15, second batch)

> **Corrected by the user (2026-10-15):** there is **no left block and no strip**. The drawer is the **same width all
> along, ≈ 115–120**. The 'strip' is a **wear line** from balls rolling along the right wall, which confirms the right
> wall is their path. The 'block's front face' is the left tunnel wall's end face and inner face, seen obliquely
> through the 130 frame. The 'block's end' at ~285 is the **edge of the goal opening**: the left wall stops there, the
> light from the goal comes in beyond it, and in video 1 the ball enters through it. That's also why the scale-free
> width measured there came out at 125–135: it measured into the opening. The lengths, speeds, step, entrance and
> rebound below still stand. The block/strip rows and the 'What this changes' bullets about them are withdrawn, and
> the roll test went to W 110, beam 240, then the same day to the two-unit version (§3, 'Insertion through the frame').

What they settle, and how. Lengths come from the tape photos 8–10. Widths come from video 2, measured scale-free: at the
moment the rolling ball is level with a feature, the ball's own image is the ruler (ball taken as 35). Speeds come from
the ball's image size frame by frame (pinhole model; the camera distance is calibrated so the ball starts at the far end,
passes the block's end, and stops at the frame). No metadata survives the re-encode (30 fps, Lavf). The **8× slow
motion** is inferred from the audio: impacts are pitched down to 200–320 Hz and stretched to 0.4–0.9 s. The real-time
tail of video 2 has a 2.4 kHz click (2.4 kHz / 8 ≈ 300 Hz).

| What | Value | ± | Source / how |
|---|---|---|---|
| **Left block** | along the left wall, from the mouth to **s ≈ 285** | 10 | Photo 6 (straight in) and videos: a plain wooden block, its inner face flat and vertical. Photo 9: the tape hook sits on its end corner and reads 31–32 at the frame (diagonal; straight in ≈ 285–295). Photo 8: along its foot, ≈ 27–28 at the frame |
| Left block, thickness at the mouth | **≈ 20** | 5 | Video 1: its front face shows through the frame, taking 17 % of the opening's width (130) |
| Clear width beside the block | **at least ~100 at the mouth; ~125–135 measured at the block's end** | see note | Video 2, frame 211: the ball is level with the block's end. The block corner to the strip's foot spans 3.6–3.8 ball widths. Near the mouth, the same method gives inconsistent values (the floor dips there, see the step), so the mouth is only bounded: 130 (opening) − ~20 (block) − ~10 (strip). **The two ends disagree by more than the method's error. Either the block tapers (thick at the mouth) or one estimate is wrong, so one ruler reading decides it (question A′)** |
| Right-wall strip | a square trim strip along the foot, the full length; **≈ 6–10 high, 8–12 wide** | 4 | Photo 6 (in good light) and video 2: a light strip with a shadow line above it, running from the mouth to the far end. In video 2 the ball rides along it |
| Floor step at the frame | **confirmed: the floor drops into the frame tube** | — | Video 2: the ball rolls off the tunnel floor and drops into the tube's lower right corner, then bounces back about one ball width and settles at the step |
| Goal entrance | the full tunnel width, from the block's end (~285) to the far end (~495) | 15 | Photo 7 (top view through the goal mouth): a felt-covered back plate slopes down, with a slot below it across the whole goal width. Photo 9: beyond the block's end a sloped board runs diagonally (the table's own ramp). In both videos the ball first appears at **s ≈ 480–495, near the middle** |
| Far end | ≈ 490 | 10 | Photo 10: 50 on the diagonal tape at the frame |
| Ball speed in the tunnel | **0.55–0.95 m/s at the beam position (s ≈ 240)**; 0.75–1.05 m/s averaged | ±20 % (×½ if the slow motion is 4×) | Video 1: 0.55–0.59 m/s (a gentle roll, from the far end into 2 waiting balls). Video 2: 0.83–0.93 m/s (no queue). No acceleration shows: the drop sets the speed, not the slope |
| Path across | from the middle at the far end, drifting right; by the block's end it rides the strip (video 2) or joins the queue diagonally (video 1) | — | Consistent with a small cross-slope to the right (≤ ~1°), as assumed |
| Rebound | video 1: ~0 (a ball at ~0.6 m/s into 2 waiting balls stays in contact). Video 2: ~1 ball width off the frame's lip (no queue) | — | Single rolls, not a hard shot. The beam at 240 keeps ~80 of rebound room past 4 balls |
| Floor slopes | **not measurable from the videos**: over 0.4 s, 1–2° changes the speed by < 10 %, below the method's noise | — | Question C stays (optional) |

**What this changes:**
- **The tunnel is not narrow beyond the block.** At the block's end the clear width is ~125–135. The binding section
  is the **mouth, beside the block's thick end, at floor level next to the strip**: ≥ ~100 by the bounds above. If the
  ruler gives ≥ 100 there, the layout in §3 fits unchanged (40 channel + 1.6 skin + a 48-wide battery block + walls
  = ~93).
- **The sled's right side stands against the strip, not the wall.** The skin's inner face sits on the strip's inner
  face line, and the ball touches the skin at its equator (17.5 > the strip's ≤ 10). So the PTFE skin, not the wood
  strip, stays the critical wall.
- **The block's end is a hazard upstream of it.** Past s ≈ 285 the tunnel widens to the left by the block's thickness,
  so a V-wall reaching further in leaves a ~20-wide slot between its tip and the left wall. A ball can't pass a slot
  that narrow, but it could perch on it. So **the sled's V-wall ends at the block's end**, ≤ 275 with a 10 margin; see
  §3, 'Revised for the left block'.
- **Roll test: hold until A′.** The piece must fit the clear width within ~25: a wider left gap lets a ball bypass
  the V-wall, and the wedge gauge only shims 16. Once A′ is in, the changes in `roll_test.py` are:
  - `W` = the smaller A′ reading − 5, with `TUNNEL[0]` = that reading.
  - The V-wall ends at s 275, so `BEAM` = 275 − (W − 53.6) / tan 35°, and `ROOF_S0` = BEAM + 5. That's ~216 at
    A′ = 100, ~198 at 112, ~180 at 125.
  - At A′ ≥ ~115 the beam lands too close to the queue (~180), so the V-wall goes to 45° instead (beam ~210), and the
    stall table gets re-run for it.
  - ROLL-TEST.md, step 2: push the piece against the strip at the right wall's foot.
- **Firmware:** the beam is blocked for (ball − aperture) / v ≈ 28–33 mm / 0.55–0.95 m/s ≈ **30–60 ms**, or ~20 ms for
  a hard 1.5 m/s shot. `min_block_ms = 5` has ≥ 4× margin, and anything up to ~10 ms is still safe.

## 2. Questions for the user (short)

**Answered (2026-10-15):** A′ (no block, width ≈ 115–120 all along) and B′ (no strip, it's wear). C (slopes) is
measured with the roll-test print in place.

**After photos 6–10 and the videos (2026-10-15), superseded:** D (step) and F (entrance) are answered, and E is half
answered (see 'Photos 6–10 and the roll videos'). What's left takes a ruler and two minutes:
- **A′ (critical, before the roll test):** at floor level, from the left block's face to the strip at the right wall's
  foot, **5 cm in** and **20 cm in** (two numbers, mm).
- **B′:** the strip at the right wall's foot: how high, and how far it sticks out from the wall (mm).
- **C (optional):** a phone level app on the tunnel floor, along it and across it (degrees).

**Earlier reduced list (after the first full-res re-read), kept for reference:**
- **A. Clear width (critical, before printing the roll test):** with a ruler across the tunnel **at floor level**, from
  the left side to the right wall, 5 cm in and 20 cm in. Is there a wooden block or sloped board along the LEFT
  side? If so: how thick is it (how far it sticks into the tunnel), and from how far in to how far in?
- **B. Right-wall ledge:** is there a strip along the foot of the right wall? How high and how wide?
- **Floor slopes (6, 11):** a phone level app on the tunnel floor, along it and across it.
- **Step at the frame (7, 12):** confirm that the tunnel floor steps DOWN ~1 cm into the black frame, and that a
  waiting ball sits down in the frame.
- **Rebound (13)** and, optionally, **the entrance's far edge and position across (3, 4)**.

The numbered questions below are the original list, kept for reference.

1. With a ruler held **straight** inside the tunnel, 5 cm in from the frame: inside width? inside height (floor to roof)?
2. Same at about 20 cm in (just before the goal entrance): width? height?
3. How far in (straight, from the outer face of the frame) is the **near** edge of the opening where the ball drops in, and how far is its **far** edge?
4. Is that opening across the full tunnel width or to one side? Roughly how wide?
5. The inclined plate in photo 3: is it a ramp the ball falls onto? Where does it start and end (distance in, height)?
6. Floor slope: does the floor fall toward the frame? Put a ball 30 cm in on the floor and let go: does it roll out by itself every time, and slowly or fast? (A level reading from a phone app also works: degrees.)
7. Is the floor at the frame **level with** the frame's lower lip, or is there a step up/down? How many mm?
8. Does the frame tube (black part) have a step to the wooden tunnel inside, i.e. is the tunnel smaller than the frame all round? How many mm per side?
9. Floor material: felt (soft, fibrous) or bare board?
10. Optional: a photo straight down through the goal mouth (from the playfield) to see the entrance from above.
11. Sideways tilt (seen from the opening, it falls to the right): a phone level app laid **across** the tunnel floor, in degrees.
    Or the height difference between the left and right edges of the floor across its ~12 cm width, in mm.
12. Where exactly does the first waiting ball stop: against a lip at the frame's outer edge, or on a step? How far in from
    the frame's outer face is the front of that ball? (It sets where the queue starts.)
13. Rebound test: with 3 balls waiting at the frame, drop a 4th through the goal mouth a few times (as in a real goal).
    How far back up the tunnel does it bounce off the waiting balls before it settles? A rough mm figure, or 'not at all'.

## 3. Concept: a sled in two units that pass the frame and lock together inside (recommended)

> **Fit 1 (user, 2026-10-16; lead: option a): this supersedes the numbers below where they differ.** L's tip hit the
> angled board at the block's end, so **L ends at s 275** (80 shorter, one print). With the queue starting at the
> frame's bar (s ≈ 33, see the step correction), a 35° wall would leave room for only 3 × 36, so the **V-wall is 45°** (lead) and the
> **beam moves 240 → 194**. Queue clear of it: 4 × 36 (the 4th's back at 177) or 5 × 31. **Rebound room ~17 past 4
> queued balls / ~53 past 3** (was ~80 / ~115); roll tests 1 and 4 watch the steeper wall.
> - **No wiper.** The tunnel is ≈ 139.5 (EST from fit 1: ~4.5 spare at W 135). L has 2 mm slide ribs on its left
>   face, so the float is ~2.5.
> - **The V-wall is ≥ 37 everywhere** (higher than a 36 ball), under a roof that slopes toward the channel. L is **52**
>   high (user: the ~55 frame opening is the limit, 3 to spare).
> - **Step correction (user, 2026-10-16):** the wooden tunnel floor is **~10 BELOW** the frame's bottom bar, not above
>   the tube floor. A unit slides in over the bar and drops down. The first waiting ball rests against the bar's inner
>   face at s ≈ 33 EST, not in the tube at s 3; the rows below that say otherwise are superseded.
> - **The rail is captive:** a dovetail rail on L, with dovetail tongues on R's bridges (R lifted out of the old groove).
> - **The bridges are 16 wide and 5 deep over the channel** (≥ 5× stiffer).
> - **R is 249 long** (s 44–293) and carries the **receiver cartridge**. It slides into the pod **from the back**,
>   through a window in the skin (user's markup), so the tunnel's right wall holds it in. Its lead leaves at the
>   channel's height through a notch in the end wall, open at the back, into the U-channel to the plug at R's front.
> - **L has a lid** over its box, in the roof's plane (user's markup: no ball onto L's top). It is a separate flat print
>   that rests on the cross walls; in the final L it becomes the battery/board hatch.
> - **Final L requirement (electronics, 2026-10-16):** the board's calibration sockets (2 rows, board x 54–62, y 23.7
>   and 26.3) must be reachable through a 14 × 14 opening in the lid (s 89–101, y −31 to −19; electronics 2026-10-17). R prints in one piece.
> - Model: `roll_test.py` (v2). Report: `reports/2026-10-16-roll-test-v2.md`.

> **Insertion through the frame (user, 2026-10-15): this supersedes 'smaller than the frame opening' below.** The tunnel
> is **wider** than the black frame's opening (~130 × 55 (was 60), R 10, then the wooden floor ~10 below the frame's bar), so a sled
> as wide as the tunnel can't come out in one piece. Same principle as the roll test (`roll_test.py`,
> `out/roll_test_vs_sled.png`): **two units that each pass the opening and lock together inside.**
> - **L (left unit, ≤ ~120 wide incl. margin, 43 high):** the channel's left face with a **rail + groove** on top,
>   the V-wall + roof over the drop zone, and a **springy wiper** at the V-wall's end. The wiper presses on the left
>   wall, so the width adapts (±~12 around the printed nominal) and no ball gets past on the left. L also carries the
>   **electronics**: the emitter well at the gate, 3×AA flat with its hatch, the board, and **USB-C on L's front
>   face** (inside the opening's projection, so it's reachable from outside).
> - **R (right unit, ~60 wide):** the **PTFE-taped skin** from s ~91 to the lead-in (one 248 print; the queue zone past the beam runs along the bare wall, lead), the **receiver pod** + 8°
>   lead-in, and **three bridges over the gate** with pegs that ride in L's groove. The groove sets the 40 gate and
>   aligns the beam: its closed upstream end is R's in-stop. The receiver lead runs along R's top to a **plug at the
>   front** (the receiver's 2-pin Dupont onto J_PT; J_PT on L's board within ~100 mm of R's front end, electronics), reachable at the mouth: no wires cross the channel, and no connector has to be found by feel.
> - **In:** L first (wiper squeezed through the frame), then R along the right wall. R's BEAM peg is guided into the
>   groove's open end at L's front, where you can see it, and the other pegs follow as R slides in. Then plug the
>   receiver lead at the front. The wiper pushes the pair right until R touches the right wall.
> - **Out (service):** unplug, pull R out (its pegs leave through the groove's open front), then L. The battery swap
>   and the hatch are done on the table. USB works in place through L's front face. Option: a battery cartridge that
>   slides out of L's front face, so a swap needs nothing removed. It's worth it if swaps turn out to be frequent.
> - **Retention:** L seats against the cabinet wall's inner face, beside the opening (needs e_L > ~5). The floor
>   slopes outward, so it's pulled onto that face, which gives a repeatable s. R is held inward by the groove's closed
>   end, and outward by a small detent at the groove's mouth that the front peg clicks past (the roll test relies on
>   friction; its test 6 checks it). Rubber feet under L, plus spring fingers to the roof. If e_L ≈ 0,
>   ears on L's front face catch the frame tube's back edge instead.
> - **Width:** L is printed for the measured tunnel width (W − 15), and the wiper absorbs ±~12. A tunnel wider than
>   ~190 makes L too wide for the opening, and then L splits again (block + V-wall unit).
> - **Open:** e_R (how far the right wall sits outside the opening). If it's ≥ ~15, a ball running along the right
>   wall meets the cabinet wall's face at the mouth instead of the tube, so R gets a short kicker at the front that
>   moves the queue into the tube (the queue start, and N, shift by ~e_R).

The insert becomes a **sled**: about 300 long, two units as above, ≤ 44 high. It slides on the floor, comes out
through the frame in two units for the battery swap, and goes back to a stop. *(Earlier text, kept for the record:
"The tunnel interior is smaller than the frame opening, so anything that fits inside can come out through the hole.
... at most 110 wide.")*

**Layout (top view in the sketch):**
- **Mirrored (lead, 2026-10-15): the channel runs along the RIGHT wall**, so the cross-slope feeds it, and the battery +
  board block sits on the LEFT.
- **One V-wall.** It runs from the left wall at the sled's upstream end to a **40 mm gate along the right wall**,
  with the beam at the gate, **~194 in from the frame** (fit 1, 45° wall; was ~240). The ball then rolls straight on down the channel to the frame,
  where players pick it up as they do now. The beam sits that far in to leave room for the queue (see 'Queue, stalls
  and rebounds').
- **Gate:** 40 wide (36 + 4), so a 31–36 ball passes either way. The beam crosses the channel at z ≈ 17 (electronics:
  16.75 covers 31–36), coaxial, behind Ø3 apertures. The emitter sits in the wide block, the receiver in a small pod (~12–16) against the
  right wall, with a pointed lead-in upstream (see the cross-slope check).
- **Right skin:** a 1.2 mm skin, faced with PTFE (or UHMW) tape, covers the right wall from the sled's upstream end to the
  frame, pod and lead-in included. A ball pressed against the right wall by the cross-slope never touches the wood, and
  wall friction drops from μ ≈ 0.4 to ≈ 0.1.
- **Wide block** (~59–65 mm, left), beside the channel and behind the V-wall: the 3×AA holder **lying flat** (47.8 × 68.8 × 17)
  at the opening end, and the 70 × 30 board flat in the triangle near the gate. A finger-pull handle on the opening face,
  above ball height. **USB-C on the opening face** (user, DECISIONS 2026-10-15): flash with the sled in place;
  pulling it out is the fallback. Two ways:
  - **A (recommended):** a short panel-mount USB-C extension (male into the XIAO, female clipped into the face). The
    layout stays as drawn and the antenna stays clear of the cells. It's one extra bought part, which electronics picks.
  - **B:** the board at the face end on the base plate, with the battery on a shelf above it. No extra part, but the
    height is ≈ 41 of ≤ 44. The XIAO's antenna end points inward, so the battery has to start ≥ 31 from the face, which
    makes the sled ~20 longer. Electronics prefers B (no extra part).
  - **Pick once the dimensions are in:** B if the interior height is ≥ 48 and the sled length still prints, otherwise A.
    For B, the XIAO's USB end sits ~0.5 behind a ~12 × 7 cut-out. For A, the extension is ≤ 20 cm, USB 2.0 data,
    clipped into the face and strain-relieved on the sled.
  - **Extension facts (electronics):** it must pass CC through (a full-featured USB 3.1 Type-C M-F). Without CC, a
    C-to-C laptop cable gives no 5 V. A right-angle male end saves ~20. The candidates are 250–300 long (Adafruit 6069:
    round, nut in a Ø12–18 hole, panel ≤ 13; or a 2-screw-flange 90° C M-F), so **150–200 of slack has to fold
    inside the sled**. That counts against A: B wins whenever the height allows it.
- **Electronics constraints:** the board stack needs ≥ 21 to the lid (3 below, 1.6 board, 14 above), with the underside
  keep-outs and support zones as in v3. The XIAO's antenna end (away from USB-C) sits ≥ 10 from the AA cells and from
  any metal (the roof bracket), facing the open channel. The JST disconnect stays: lying flat, the FIT0610's switch
  faces down, so the plug is the off switch.
- **Wires** cross the channel in a **strap above the ball** at the beam (as v3's strap band), not under a base plate.
  The channel has **no plate**: the ball rolls on the tunnel floor. A 3–4.5 plate would be a climb at the sled's edge,
  and at a 1.6° floor a slow ball can't climb 3 mm (it would need a ~1° ramp ~170 long). The strap sits ≥ 2 above a
  36 ball (≈ 38–42 plus the feet), so it needs an interior height of ≥ ~46. If the measured height is lower, ask
  electronics for a flat ≤ 1 mm crossing (flat flex or enamelled wire under tape) with feathered edges instead.
  The right skin (with the pod) and the block are joined by that strap, plus bridges above ball height at the sled's
  two ends. The front bridge sits over the channel at the opening face, so the queue rolls under it.
- **Height:** battery 17 + the block's base plate 3, or the board stack ≈ 20, so the walls only need ~38–44 (the
  strap over the channel sets the top at ~42–44). That leaves the clearance
  under a 47–52 roof that the slide needs.
- **Prints** upright on the block's base plate; the strap bridges ≤ 40, no supports. At ~300 long it's two parts pinned
  together (the printer takes 256). Under the goal entrance (s ≥ ~265) the block's top ramps down into the channel, as
  in v3, so a ball landing on it rolls into the funnel.

**Revised for the left block (photos 6–10, 2026-10-15): WITHDRAWN.** The user says there's no block. The layout
above stands (beam 240, V-wall 35°), built as two units (see 'Insertion through the frame'). Kept only for the record.
The layout above stays: channel right, battery + board
block left. What changes:
- **Width:** the sled is sized to the clear width **at the mouth, beside the block's thick end, at floor level**,
  measured from the block's face to the strip's inner face, minus 5. Behind the block, the battery block sits against
  its face, and the block works as the sled's left wall. Nothing goes above the block (it reaches nearly to the roof) or upstream
  of it (that's where balls land).
- **Right side:** the skin stands on the floor against the strip's inner face. Above the strip, the sled may reach
  over it to the wall (a ledge), which steadies it.
- **Length and beam:** the V-wall must end before the block's end (≤ 275), or it leaves a ~20 slot to the left wall
  where a ball can wedge. With a 35° V-wall spanning the block width (W − 54), that puts the **beam at ~200–215**
  (depending on the width) instead of 240, and the sled runs from 36 to ~275 (240 long, so maybe one print). Rebound room past 4 queued balls
  drops from ~80 to ~60 (past 3: ~95). Video 1 showed ~0 rebound at ~0.6 m/s, and roll test 4 checks it.
- **The ball arrives fast** (0.55–0.95 m/s at the beam), so the stall margins below only matter for gentle drops and
  creep. They're kept as they are.
- **Below ~95 clear**, the battery block (48) no longer fits beside the 40 channel. Then lead's fallback applies: the
  battery lies flat **on top of the board stack** at the opening end (it needs ≥ 44 interior height, which the photos
  give), and the board moves to the triangle behind the V-wall.

**Cross-slope check (lead: "can a ball stall or hug the wrong wall upstream of the V?").** Same quasi-static model as
`insert.py` (gravity along the wall minus wall friction μ 0.4, over rolling resistance 0.015; ≥ 1.5 wanted, < 1 stalls).
The longitudinal slope is still unknown (question 6), so the two rows bracket it:

| Floor slope along / across | V-wall 20° | V-wall 27° | V-wall 35° | Bare right wall | Lead-in 5° | Lead-in 10° | Lead-in 15° |
|---|---|---|---|---|---|---|---|
| 1.6° / 0° | 1.50 | 1.32 | 1.10 | 1.86 | 1.79 | 1.70 | 1.61 |
| 1.6° / 0.5° | 1.91 | 1.79 | 1.62 | 1.63 | 1.51 | 1.37 | 1.23 |
| 1.6° / 1° | 2.15 | 2.19 | 2.15 | 1.40 | 1.23 | 1.04 | 0.86 |
| 1.6° / 2° | 2.55 | 2.72 | 2.86 | 0.93 | 0.66 | 0.38 | 0.10 |
| 3° / 1° | 3.64 | 3.42 | 3.11 | 3.03 | 2.79 | 2.54 | 2.26 |

- **The V-wall gets easier.** The cross-slope pulls a ball off the V-wall's face, so there's less friction, and a
  steeper V-wall (27–35°, a shorter sled) works once the cross-slope is ≥ ~0.5°.
- **The wrong wall (left) can't hold a ball.** Upstream of the V, the cross-slope pulls every ball away from the left
  wall. The V-wall tip sits 1 mm from that wall, as in v3, so a ball can't catch on it.
- **The right wall is now the critical path.** Every ball ends up rolling along it, pressed in by the cross-slope, so
  anything that sticks out of it costs margin. The receiver pod is the only thing there. On bare wood (μ 0.4) even the
  plain wall drops below 1.5 at 1.6° / 1°, and a 10° pod lead-in to 1.04. Hence the **PTFE-taped skin** (μ ≈ 0.1):

  | Along / across, μ 0.1 | V-wall 35° | Skin | Pod lead-in 5° | Pod lead-in 8° |
  |---|---|---|---|---|
  | 1.6° / 0° | 1.42 | 1.86 | 1.84 | 1.82 |
  | 1.6° / 0.5° | 1.80 | 1.80 | 1.73 | 1.68 |
  | 1.6° / 1° | 2.18 | 1.75 | 1.62 | 1.54 |
  | 1.6° / 2° | 2.86 | 1.63 | 1.40 | 1.26 |
  | 3° / 1° | 3.42 | 3.38 | 3.23 | 3.13 |

  So ≥ 1.5 everywhere to the beam up to ~1° across with an 8° lead-in (85 long for a 12 pod). For steeper cross-slopes
  the lead-in gets shallower, or electronics thins the pod (leads bent, ~9). With no cross-slope the V-wall goes back to
  ~27°. A plain reflector instead of the pod doesn't work: the white ball reflects IR too.
- **Roll test in the real drawer** before trusting any of it (as for v3).

**Queue, stalls and rebounds (user, firmware, twin, lead; 2026-10-15).** Usually 3 balls are in play, so up to 3 wait
in the drawer (designed for 4 × 36). Each beam break is a goal, so:
- **No ball may stop in the beam or upstream of it.** A waiting ball in the beam blinds it; two touching balls through it
  count as one goal. The whole path from the drop zone to the beam is on the sled, on the taped skin and V-wall, with
  stall margin ≥ 1.5 (table above). Nothing stands in the channel: no plate, no lips. The ball rolls on the tunnel floor.
- **The queue is downstream only.** It starts where the first ball stops (in the frame tube, ~3 in: question 12) and
  runs single file along the right skin (the cross-slope lines them up; side by side would need 72 of the 117).
  4 × 36 = 144, so the last waiting ball's back is at ~147. With 31 balls it's 127.
  **Room before the beam (firmware, 2026-10-15): a hard spec, measured from the final beam position.** With the first
  ball's front at ~3, ball n's back is at 3 + 36 n, so the room is N = floor((BEAM − 3) / 36) balls of 36. A ball
  resting IN the beam blinds it: every later goal is missed until the drawer is emptied. At beam 200–215, **N = 5**
  (the 6th spans 183–219). Required: N ≥ 4 (usually 3 in play). The sled CAD and the roll test assert it.
- **A ball must not bounce back into the beam.** A ball arriving at ~0.2–0.5 m/s (0.21 after rolling 250 mm from rest
  at 1.6°) hits the queue and rebounds up the slope: ~20–100 mm at a restitution of 0.5, ~200 at 0.7 and 0.5 m/s.
  So the beam sat at **~240**, which left **~80 of rebound room** past 4 queued balls (~115 past 3). *Fit 1: beam
  194 (45° wall, queue from the bar at ~33), so ~17 past 4 and ~53 past 3. Roll test 4 decides whether that's enough.* Question 13
  measures the real rebound. The pod's downstream face is a stop too: a rebounding ball that hugs the right wall (the
  cross-slope pushes it there) hits that face with its edge ~14 short of the beam. If the test shows longer rebounds,
  the beam moves further in, under the entrance (with ramps, as in v3).
- **Nothing downstream sends a ball back upstream (twin: a creep back into the beam > 1.5 s later is an extra goal).**
  The floor falls toward the frame, so the queue always drains away from the beam. From the beam to the frame the
  channel is straight and flush: a smooth skin on the right, the block's straight face on the left, no plate, steps or
  lips. The only thing a ball can hit is the frame's lip or the ball in front of it, and that rebound is covered above.
  The cross-slope against the skin only adds friction along the wall; it can't push a ball uphill. Open point: a step
  up at the frame (question 7/12) would make the first ball's rebound bigger, and question 13 covers that too.
- **Reach:** players only ever take the first ball, in the frame tube in front of the sled, as now. The others roll
  forward to the stop by themselves (no hand goes into the 40 channel).

**Beam position vs goal → sound delay (lead/user, 2026-10-15).** In both videos the ball first lands on the floor at
s ≈ 480–495, coming in from the left through the goal opening (s ~285–495). It then rolls at 0.75–1.0 m/s (0.57 on
the gentle roll):

| Beam at | Landing → beam | Saved vs 240 |
|---|---|---|
| 240 (roll test, funnel + gate) | 0.25–0.34 s (gentle 0.43) | — |
| ~275, the opening's downstream edge (10 margin) | 0.20–0.29 s (gentle 0.38) | **35–50 ms** (gentle 60) |
| ~430, deep in the drop zone | ~0.05–0.1 s | ~0.2 s, **but only if no ball ever lands downstream of it**. Two samples can't show that, and a missed goal is worse than a late one |

- **Funnel + gate moved up under the entrance (v3-style ramps): no.** The V-wall and ramps would sit where balls land,
  which brings back the bounce and stall risks in front of the beam. The sled grows to ~370 (still 2 prints), all for
  ~50 ms.
- **Full-width beam at ~275, no funnel ahead of it: NOT ADOPTED (lead, 2026-10-15: it saves ~50 ms for ~1.6 months of goal-counter battery; TSAL6100). Kept for the record:** Nothing
  stands in the counting path, so no stall can ever hide a goal, and it saves the ~50 ms. The funnel and battery
  block move downstream: the V-wall's tip goes ≥ 40 past the beam, so a ball resting against it stays clear (V-wall
  ~235 → gate ~155 at W 110). Queue room N = floor((275 − 3) / 36) = 7, and the rebound room grows to ~125 past 4
  balls. To watch: light from the goal opening right above the beam (modulated IR and a hood, for electronics), and
  the left module sits ~10 short of the left wall's end at ~285. A double crossing from a bounce falls inside
  `lockout_ms`.
- **The roll test doesn't change.** The same V-wall, channel and queue sit ~85 further downstream in the full-width
  layout, so tests 1–3 and 5–6 check the same things. Test 4 (rebound vs the BEAM mark at 240) is conservative for a
  beam at 275.
- The bigger lever (~0.2 s) needs landing data: film ~20 real goals from the frame, hard shots included, as in the
  user's videos, and I measure where each one lands. Only if every ball lands at ≥ ~450 could the beam move deeper,
  and even then with a full-width beam.

**Stop and retention (repeatable, no tape):**
- **In-stop:** two small ears on the opening face, a little wider than the tunnel interior but narrower than the frame.
  They hit the wooden tunnel's end face inside the frame tube (question 8), so the sled lands in the same place every
  time, within ~1 mm. If there's no step, the fallback is a tail that touches the far end wall.
- **Holding it in:** the floor falls toward the frame, and balls push outward, so the sled must not creep. 2 printed
  spring fingers on top press up on the roof plate (a few N each), plus 4 adhesive rubber/silicone bump feet under the
  base. That gives high friction on wood (or felt), and a firm pull still slides it out. Motion wake through feet and
  springs gets checked on the bench in the real drawer (`MOTION_THRESHOLD_MG`). It works on either floor, with
  no tape and nothing left in the cabinet. If the floor turns out to be felt, hook-side Velcro under the base is an
  extra option.
- **Swap:** take the balls out, pull the sled out by its handle (~300 mm straight through the frame), open the top
  battery hatch on the table, swap, push it back to the stop. USB-C works with the sled half out or fully out.
  **No leads ever move:** everything is on the sled.

**Fixed insert (taped in the tunnel, service through the face) for comparison:**

| | Sled | Fixed insert |
|---|---|---|
| Install | Push in to the stop | Taped blind 15–25 cm deep through a 60 mm hole; the tape can't be pressed down |
| Battery swap | Out on the table, top hatch, flat holder; trivial | Cartridge or holder pulled out of the face. Needs ≥ 70 mm free in front, and the frame tube is only ~35 |
| USB | Port on the face via a panel-mount extension; flash with the sled in place | Plug on the face (same extension) |
| Beam position | Repeatable to ~1 mm via the stop | Fixed once taped |
| Risks | Creeping out (spring fingers + rubber feet); a ball wedging between the sled and the roof (the gap is checked) | Badly pressed tape letting go; no way to fix or reposition without reaching in |
| Parts | 1–2 printed + 4 rubber feet | 1 printed + cartridge + tape |

**Recommendation: the sled.** A fixed insert in a closed 115 × 50 tunnel can't be installed or serviced well through a
60 mm hole, and the battery-lying-flat requirement already fills the width beside a centred gate. That's why the gate
moves to one wall.

**Carried over from v3:** the stall check, the beam elements and wells, the board clip and detent pattern, the
crush-rib hatch, the gate (`assembly-review/check.py`), and a strap over the gate for the wires. **Dropped:** the 4-side ramps (only the
part under the entrance gets ramps, if any), the end-face tunnel/JST pocket and the long battery lead (the board-side
lead becomes short again).

**Next, once the answers are in:** set the new drawer parameters, choose the V-wall angle and the pod lead-in from the
measured slopes, along and across (the stall margin stays ≥ 1.5 on both), and place the beam from the measured stop
and rebound (questions 12, 13), then rewrite `insert.py` as the sled.
