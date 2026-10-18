# L at 54 + the display: 0.96" tilted vs 0.91" upright (mechanical proposal, 2026-10-18)

Status: **PROPOSAL**, to agree with ux, electronics and assembly-review.

**Inputs:**
- user: the opening is 57, so L grows from 52 to 54 (`sled.TOP`);
- user: a slimmer display is fine;
- electronics: `electronics/slim-display-options-2026-10-18.md`;
- ux: `ux/goal-counter-phase1-2026-10-17.md` B5a, where 2 lines at 8×16 are enough.

## Readability as seen through the frame

Both displays have the same pixel pitch, so an 8×16 glyph is ~2.7–2.8 mm on either, **face-on**.

People see the screen through the 35-deep frame, from level up to ~23° above level (where the frame's top edge
cuts in). The 0.96" module is 27.8 tall; even at L 54 the dash row is only 22.8 tall, so it has to tilt back
(~45° at 54, 55° today). A tilted face foreshortens:

| | Apparent 8×16 glyph, view level | at 20° up | Lines | Face |
|---|---|---|---|---|
| 0.96" tilted 45° (L 54) | 2.7 × cos 45° ≈ **1.9** | 2.7 × cos 25° ≈ 2.4 | 4 | tilted, 23 deep |
| 0.96" tilted 55° (as built, L 52) | ≈ 1.6 | ≈ 2.3 | 4 | tilted |
| **0.91" upright** | **2.8** | 2.6 | 2 (line 2 cycles: ux) | upright, ~4 deep |

The upright 0.91" reads **~45 % taller at a level view** and ~10 % taller from 20° up. Seen from ±20° sideways,
both lose the same; neither is occluded (see below).

## What the 0.91" frees

- **No tilted pocket.** The module sits in a front pocket behind an upright window, held by 2 lips on its long
  edges (electronics). That replaces the 55° pocket, the open-behind cavity and the glue.
- **Depth.** It is ~4 deep instead of ~23, so the space behind it in the dash takes the leads, the J_PT channel and
  R's lead drop.
- **The cost is width.** The module is 38 wide (27.3 for the 0.96"), so it can't sit beside both the button and the
  bay.

## Layout at L 54 (dash row z 31.2–54; e_L 10–15)

| | Where | Margin |
|---|---|---|
| Undo button | as now: cap centre r 22, Ø10, z ~43 | cap ≥ 2 inside the opening at e_L 15 (unchanged) |
| 0.91" module | 38 × 12, upper band: r ~30.5–68.5, z ~41.5–53.5, pins at the right end | active area **r ~35–57**, z ~44.5–50: mid-opening. From 20° left the frame hides r < e_L + 13 ≈ 28, so 7 to spare. From 20° right, nothing hides it |
| Receiver bay | under the module's right end, r 58.8–68.4, floor z 32.4 | front opening ~9.6 × 8.6 (was open on top). Service only now: a fingertip on the plug's pull tab. R's lead drops in behind the module (s 41–56), still open on top there |
| Buzzer, channels | as now | |

The drawer row is unchanged. L's box, lid and dash all grow 2 taller, the front face is ~39 tall, and L passes the
57 opening with 3 to spare over the bar.

## Recommendation

**The 0.91" upright.** It reads best through the opening at a level view, is simpler to print and mount, and keeps
the button where it is. Its one trade is the bay's front opening, which is now only for service. The fallback is the
0.96" at 45° if ux rules that the 4 lines are needed.

After agreement:
- `sled.py` (TOP 54, the 0.91" pocket + lips, the bay under it);
- checks at e_L 10/15;
- eye renders (straight on, ±20°);
- the gate with assembly-review;
- the guide;
- §0 is already updated (opening 130 × 57).

## Update: electronics OK

- **Display:** same J_OLED, address and battery. The OLED lead is ~200 on a 30 cm jumper.
- **R's sensor lead:** keep it ≥ 5 from the module's back, because of the charge pump.
  - In this layout the lead drops into the bay at s 52–55, ≥ 11 behind the module's back (s ~40). The build will
    assert ≥ 5.
  - electronics benches it for no false goals with the screen on.
- **BOM:** electronics switches row 22 once lead marks this agreed.

## Built 2026-10-18 (lead approved; ux, electronics and assembly-review agreed)

- **L:** 54 tall (`TOP` follows the measured opening). The roll test stays at 52, as printed.
- **0.91" module:** upright in a front pocket, open out the back, snapped in past 0.8 lips (no glue).
  - Active area at r 34.3–56.7, z 43.7–49.3.
  - Seen straight on and at ±20°: asserted, and the eye renders agree.
- **Bay:** under the module's right end. Its front opening is 9.6 × 6.9; the drop behind the module is open on top.
- **R's pair** (assembly-review): the plug is modelled at its real 14 length, front end at s 42. The pair U-turns over
  it inside the bay, so nothing is proud of the face.
  - It passes ≥ 2.1 under the OLED's bottom edge.
  - It runs ≥ 5 behind its back (electronics' rule) and drops at s 51–55.
- **Pull cord:** through the bay wall into a slot open behind.
- **Testing:** the new asserts are mutation-tested 6/6.

## Update: assembly-review S35/S36

- **S35:** the OLED drops into a slot from the dash's top, between the window wall and two 0.8 rails behind its ends.
  The lips are gone, so nothing has to flex.
- **S36:** the header moved forward (back wall at s 51), so the plug's front end is 1 behind the face. R's pair U-turns
  ~3 proud, above the drawer and right of the OLED, then drops at s 46.5–50.5 (≥ 5 behind the OLED's back). The notches
  in L's and the dash's right walls now start at s 45.
- **Testing:** the new asserts are mutation-tested 4/4.
- **Gate:** 113/1. The 1 is the gate's OLED path, which still inserts the module from behind.
