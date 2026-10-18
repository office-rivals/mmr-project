"""Scoreboard enclosure: a wedge on top of a table end, e-paper + soft keys tilted toward the players.

    uv run python scoreboard.py          # self-check, STL/3MF + PNG into out/
    uv run python scoreboard.py --check  # self-check only

Parts from electronics/dimensions.md (scoreboard v1), physical UX from ux/PHYSICAL-UX.md ('v5: fit the end
shelf'). v5 sits at the RIGHT end of the end shelf beside the bead counter (shelf-11..13): <= 92 deep on its 95 flat,
taped. Frame: x across the scoreboard (+ = right seen from the front: the table corner), y from the front edge toward
the back, z up from the shelf top. Face coordinates: u across, v up the slope from the bottom edge,
w out of the face (negative = inside).
"""
import math
import sys
from pathlib import Path

from build123d import (Align, Axis, Box, Cylinder, Kind, Mesher, Plane, Polygon, Pos, Rectangle, RectangleRounded, Rot,
                       chamfer, Text, export_stl, extrude, loft, offset)
from render import render

# ---- placement: the end shelf (user, shelf-11..13; lead) ---------------------------------------------------------
TILT_DEG = 50.0           # front face from horizontal: ux 42-50; 50 (ux, v5): the shelf caps the depth, not the height
SHELF_FLAT = 95.0         # the shelf's flat top, from the playfield edge (user-measured); then it rounds down
DEPTH = 88.5              # body depth; + the cover (WALL) = the footprint, <= SHELF_FLAT - 3 (lead: <= ~92)
WING = 43.0               # right wing beside the screen: badge target + RC522 behind the face (ux v5)
TAPE_Y = (2.0, 35.0, 66.0)  # 19 mm foam-tape strips across the full width (fronts, y), all on the flat

# ---- parts: electronics/dimensions.md -------------------------------------------
GLASS = (91.0, 77.0, 1.2)                 # GDEY042T81 panel glass w, h, t; held by its border only
ACTIVE = (84.8, 63.6)                     # active area, centred left-right (3.1 each side)
ACTIVE_DX = 0.0                           # active-area centre minus glass centre, + = right seen from the front (measure on arrival)
ACTIVE_BOTTOM = 3.1                       # active area to the glass edge opposite the FPC (FPC edge up, ux); 10.3 at the FPC edge
FPC_ROOT, FPC_TAIL = (36.7, 4.7), (12.5, 16.8, 18.5)   # root width + start, tail width + start + length; from the glass's left end seen from the front (measure on arrival)
ADAPTER = (41.0, 22.0, 1.6)               # DESPI-C02 board; ZIF on its top 41 mm edge (assumed centred), 8-pin header on the bottom edge
ADAPTER_ENV = (2.5, 5.0, 5.0)             # ZIF in front of the board; soldered wire stubs <= 5 behind it along the bottom 5 mm (electronics)
FRAME_T, PIN_D = 2.0, 2.6                 # glass retainer frame thickness; pins on the face's inner surface (frame holes 2.75: snug, removable)
KEYS = 4
KEY_PITCH = 20.32                         # cap pitch: ux matched the labels to it
KEY = (16.0, 11.0, 3.0)                   # printed cap w, h, proud of the face: an MX fires 2.0 down, 1 mm before flush (ux/lead)
KEY_OPEN = 0.5                            # face opening beyond the cap, per side (ux >= 0.5); 0.5 x 45 deg flare outside
# Cherry MX (the user's switches; nominal datasheet values, measure one): plate-mounted, hand-wired, no key strip
MX_CUT, MX_PLATE = 14.0, 1.5              # plate cutout (square), plate thickness for its clips
MX_TOP = (15.6, 6.6)                      # top housing: square, height above the plate's front
MX_BOT = (13.9, 5.0)                      # bottom housing: square, depth behind the plate's front (the plate included)
MX_PIN = 3.3                              # pins beyond the bottom housing; at (-3.81, +2.54) and (+2.54, +5.08) from the centre
MX_STEM = (8.0, 11.6, 4.0, 1.3)           # slider face and cross top above the plate's front; cross arm length, width
MX_ACT, MX_TRAVEL = 2.0, 4.0              # actuation, total travel
STEM_CLR = 0.10                           # cap socket clearance per side: pick it from the stem-fit test print (0.05-0.20)
CAP_STOP = 3.3                            # cap skirt -> top housing at rest: a hard stop just past flush (a finger stops at 3)
WIRING = 3.0                              # behind the pins: joints, the KEYS/GND bus wires, the 3 ladder resistors (electronics)
PLATE_POST, PLATE_TRAVEL = 41.0, 4.0      # outer plate posts' u (inboard of the LED-strip posts); travel over the post heads
KEYHOLE = (3.0, 2.4, 4.2, 1.2)            # plate keyholes: slide down the face, neck Ø, head Ø, head t (review S18: removable)
PLATE_V = (-11.5, 8.5)                    # plate's bottom rail edge, top edge, about the key centre (1.5 past the cutout)
STRIP = (98.0, 8.0, 1.6)                  # LED-only perfboard strip: w, h, t; the 4 LEDs on its centre line at the key u
STRIP_HOLE = (46.5, 2.5, -1.0)            # its 2 pin holes: u from the centre (posts outboard of the bar), Ø, v below the LED line (clear of the frame)
LED = (5.0, 5.9, 1.0, 8.6, 0.5)           # Kingbright WP154A4SUREQBFZGW (white diffused, 60 deg): body Ø, flange Ø, flange t, flange -> dome, flange above strip (flush)
LED_STUB = 10.0                           # lead stubs + heat-shrunk joints below the strip's underside at each LED (electronics)
DIFF = (84.0, 6.5, 2.0)                   # bought 2 mm OPAL acrylic bar over the 4 LEDs, cut to length x height (glossy both sides)
DIFF_LIP = 0.5                            # face skin left in front of the bar: 0.7 ledges hold it, the bar sits flush with the inside
MIX = 8.0                                 # LED dome tip -> bar: each key's segment glows ~7 wide (FWHM); baffles keep them apart; sets the sleeve
MB_UNDER = 3.5                            # main board: joints + wires below it, except the joint-free zones (electronics)
BOARD = (30.0, 70.0, 14.0 + 1.6 + 4.0)    # main perfboard (same as the goal device): w, l, envelope with standoffs + keep-out
CLIP_T, HOOK = 1.2, 0.6                   # snap beam thickness, hook overhang (<= 2 % strain over a 10 mm beam)
BAT = (68.0, 17.0, 47.0)                  # DFRobot FIT0610 standing upright against the back cover, on a shelf over the main board: w (x), d (y), h (z)
SHELF_T = 2.5                             # battery shelf thickness
CLR = 0.5                                 # glass recess and pocket clearance
NFC = (25.0, 1.5)                         # on-metal (ferrite-backed) NTAG213 Ø, thickness; inside the LEFT (inner) wall, read through it
NFC_METAL_CLR = 10.0                      # sticker edge to the AA cells: closer metal detunes a plain NTAG213 (lead)
NFC_YZ = (62.0, 62.0)                     # v5 (lead): upper back of the inner wall, above the bead counter (beads 25 tall)
NFC_LOOP = (60.0, 45.0)                   # to the RC522 loop copper: target, hard minimum (electronics)
COUNTER = (170.0, 2.0, 10.0)              # free rail length at the right end, gap to the side panel, a phone (+ case) held flat
PCA = (62.5, 25.4, 1.6, 2.0, 2.0, 1.0)    # Adafruit 815 PCA9685 (no headers): l, h, t, front parts, back wire stubs, outline tolerance
RC = (40.0, 60.0, 1.6, 4.0, 19.0, 38.0)   # RFID-RC522 module: w, l, t, parts on the component side, loop centre from the far end, loop length
RC_AIR = 1.5                              # flat back to the face: 0.5 printed pads + 1 mm foam tape (wire stubs <= 1 on the back)
TILE = (40.0, 28.0, RC_AIR, 1.5)          # translucent target insert (natural PETG): w, h, shoulder t (= the reader's air: it holds it flush), width
RC_TOP = 1.0                              # v5: the module's loop end this far below the face's top edge (loop as high as it goes)
LED5_CLR = 10.0                           # LED5 body outside the loop trace (electronics); v5: below the module, lights the tongue's end
WIN = (3.0, 0.9, 3.0, 0.6, 3.0, 2.5)      # protective window, 3 mm low-haze anti-glare PC (user/ux): t, air to the glass, ledge beyond
                                          # the glass sides/top, bottom, rim height (= t: flush), corner radius
WIN_VIEW = (2.8, 2.8)                     # clear aperture beyond the ACTIVE area: sides, top/bottom, EQUAL (user: symmetric frame);
                                          # a matte black border on the window's back and the skin's view opening both follow it
FOAM_P = (1.0, 0.8)                       # foam between the panel and the backing plate: free, fitted (full-area backing, lead)
USB_EXT = (28.0, 9.0, 2.0, 17.0, 9.5, 4.0, 12.0, 7.0, 15.0)   # panel-mount C-C extension (electronics, est.): flange w, h, t, hole
                                          # centres, cutout w, h; body behind the flange w, h, depth (measure on arrival)
USB_PLUG = (12.0, 6.5, 16.0, 15.0)        # its male end: RIGHT-ANGLE, in-plane type (cable leaves sideways, toward the face): overmould
                                          # w, h, length from the port incl. the turn, cable bend radius after it (EST, measure)
USB_CLEAR = 29.0                          # left wall -> main board's USB end: the male plug goes straight in (electronics >= 25)
SPK = (40.0, 40.0, 15.0, 2.5)             # speaker (default build): outline along y, along z (equal = round: the cheap 40 mm; the PUI
                                          # AS04008PO is 40 x 28.3), depth incl. wire tags, front rim t (electronics; measure on arrival)
SPK_YZ = None                             # grille centre on the RIGHT (outer) wall: set below, back-low (loop keep-out, lead)
FOAM = 1.0                                # double-sided adhesive foam ring: seals the speaker + cup to the wall and holds them
CUP = (28.0, 1.6, 0.2)                    # back cup: cavity depth behind the rim, wall, clearance in the wall's locating lip per side
GRILLE_HOLE = (2.0, 3.2)                  # grille: hole Ø, hex pitch: ~35 % open over the cone (electronics 30-40 %)
BUZZ = (12.0, 9.0)                        # Same Sky CMT-1209-390T: Ø, height (±0.5); sound port on its face, 2 flying leads
AMP = (27.0, 21.0, 1.6, 6.0, 1.0)         # PAM8302 clone bay: x, y (board ~20 x 15-25, measure on arrival), t, parts on top, foam tape
AMP_XY = None                             # bay's -x/-y corner: v5 on the wing's floor, in front (set below)
CAP470 = (10.5, 14.0)                     # its 470 uF electrolytic lying flat beside it (along y): Ø, length incl. leads' bend


# ---- body -----------------------------------------------------------------------
WALL = 2.5
MARGIN = 6.0                              # glass to side wall
FACE_TOP = 5.5                            # face beyond the glass's top edge (frame + FPC fold)
RIB = (1.0, 0.15)                         # crush ribs on the cover lip: Ø, interference (friction fit, no magnets)

# ---- derived ---------------------------------------------------------------------
_T = math.radians(TILT_DEG)
W_MAIN = GLASS[0] + 2 * (MARGIN + WALL)   # screen + keys section (inner side, next to the bead counter)
W = W_MAIN + WING
U0 = W_MAIN / 2                           # key-row and ACTIVE-AREA centre (ux: labels +/-0.5 over the keys)
U_GL = U0 - ACTIVE_DX                     # glass centre
W_CAP = -WALL - 0.5                        # cap skirt at rest, just inside the face
P_W = W_CAP - CAP_STOP - MX_TOP[1]        # the plate's front face (w)
W_WIRE = P_W - MX_BOT[1] - MX_PIN - WIRING  # deepest wiring
W_STRIP = -(DIFF_LIP + DIFF[2] + MIX + LED[3] + LED[4])   # LED strip front: the domes end MIX behind the bar
# v5: the key row as low on the face as its opening allows; a vertical FRONT WALL lifts the face so the switches,
# wiring, the plate's rail and centre tab clear the floor on their way in (ux: shorten the face below the keys)
_lowest = [(-MX_BOT[0] / 2, P_W - MX_BOT[1]), (-2.0, W_WIRE), (PLATE_V[0], P_W - 7.5), (-16.0, P_W - MX_PLATE)]   # (v, w)
V_BTN = WALL + 6 + KEY[1] / 2
FRONT_H = math.ceil(2 * max(WALL + 0.5 - (w - PLATE_TRAVEL) * math.cos(_T) - (V_BTN + v) * math.sin(_T) for v, w in _lowest)) / 2
OPEN_V = KEY[1] / 2 + KEY_OPEN            # face opening's half height
DIFF_V = V_BTN + OPEN_V + 1.2 + (DIFF[1] + 0.4) / 2                # bar pocket centre: a 1.2 web above the key openings
LED_V = max(DIFF_V, V_BTN + PLATE_V[1] + LED[1] / 2 + 0.3)        # LED row: on the bar, clear of the plate's top edge
KEY_TO_ACTIVE = DIFF_V + (DIFF[1] + 0.4) / 2 + 1.25 + ACTIVE_BOTTOM - V_BTN - KEY[1] / 2   # pocket, 1 mm face, glass recess
V_ACT = V_BTN + KEY[1] / 2 + KEY_TO_ACTIVE + ACTIVE[1] / 2          # active-area centre along the face
V_GLASS = V_ACT - ACTIVE[1] / 2 - ACTIVE_BOTTOM + GLASS[1] / 2     # glass centre
F = V_GLASS + GLASS[1] / 2 + FACE_TOP                              # face length
H = FRONT_H + F * math.sin(_T)
FACE = Plane(origin=(0, 0, FRONT_H), x_dir=(1, 0, 0), z_dir=(0, -math.sin(_T), math.cos(_T)))   # outward normal
OUT = Path(__file__).parent / "out"


def box(x0, x1, y0, y1, z0, z1):           # corners in any order
    (x0, x1), (y0, y1), (z0, z1) = sorted((x0, x1)), sorted((y0, y1)), sorted((z0, z1))
    return Pos(x0, y0, z0) * Box(x1 - x0, y1 - y0, z1 - z0, align=(Align.MIN,) * 3)


def on_face(u, v, w, shape):              # place a shape at face coordinates (u, v, w)
    return FACE * Pos(u, v, w) * shape


MIN_TOP = (Align.CENTER, Align.CENTER, Align.MAX)
MINB = (Align.CENTER, Align.CENTER, Align.MIN)
outline = Polygon((0, 0), (DEPTH, 0), (DEPTH, H), (F * math.cos(_T), H), (0, FRONT_H), align=None)
body = extrude(Plane.YZ * outline, W)
inside = Pos(WALL, 0, 0) * extrude(Plane.YZ * offset(outline, -WALL, kind=Kind.INTERSECTION), W - 2 * WALL)
body -= inside
body -= box(WALL, W - WALL, DEPTH - WALL - 1, DEPTH + 1, WALL, H - WALL)          # open back, closed by the cover

key_u = [U0 + (i - (KEYS - 1) / 2) * KEY_PITCH for i in range(KEYS)]
hole = (KEY[0] + 2 * KEY_OPEN, KEY[1] + 2 * KEY_OPEN)
body -= [on_face(u, V_BTN, 0, Box(*hole, 20)) for u in key_u]              # cap openings
flare = loft([Rectangle(hole[0] + 1.0, hole[1] + 1.0), Pos(0, 0, -0.5) * Rectangle(*hole)])   # 0.5 x 45 deg: a tilted cap can't catch
body -= [on_face(u, V_BTN, 0.01, flare) for u in key_u]
BAT_Y0 = DEPTH - 4.5 - BAT[1]             # battery front edge (clear of the cover lip)
# MX key row: the 4 switches clip into a printed plate (hand-wired behind it). The plate goes over the mushroom heads
# of 3 posts on the face's inside (2 beside the outer keys, 1 under the middle), held KEYHOLE[0] high so the big
# ends of its keyholes pass them, then slides down the face: the heads hold its back, so a press pulls the necks, and gravity (0.72 g along the
# slope) keeps it down. Slide it up to take it out (switch swap). Its bottom rail stiffens it. The LED-only strip
# slides onto 2 pins on its own posts, above the plate; a hot-glue dot over each pin tip holds it (review S17).
POST = lambda u, v, w_end: on_face(u, v, -WALL + 0.1, Box(3.4, 3.4, -w_end - WALL + 0.1, align=MIN_TOP))   # noqa: E731
plate_posts = [(U0 + sx * PLATE_POST, V_BTN) for sx in (-1, 1)] + [(U0, V_BTN - 14.0)]
for u, v in plate_posts:
    body += POST(u, v, P_W) + on_face(u, v, P_W, Cylinder(KEYHOLE[1] / 2, MX_PLATE + 0.1, align=MIN_TOP)) \
        + on_face(u, v, P_W - MX_PLATE - 0.1, Cylinder(KEYHOLE[2] / 2, KEYHOLE[3], align=MIN_TOP))   # post, neck, head
for sx in (-1, 1):
    body += POST(U0 + sx * STRIP_HOLE[0], LED_V + STRIP_HOLE[2], W_STRIP)
    body += on_face(U0 + sx * STRIP_HOLE[0], LED_V + STRIP_HOLE[2], W_STRIP, Cylinder(STRIP_HOLE[1] / 2 - 0.2, STRIP[2] + 1.0, align=MIN_TOP))   # 1 proud: glue dot
pl_u = PLATE_POST + 2.5
plate = on_face(U0, V_BTN + (-8.5 + PLATE_V[1]) / 2, P_W, Box(2 * pl_u, PLATE_V[1] + 8.5, MX_PLATE, align=MIN_TOP)) \
    + on_face(U0, V_BTN + (PLATE_V[0] - 8.5) / 2, P_W, Box(2 * pl_u, -8.5 - PLATE_V[0], 7.5, align=MIN_TOP)) \
    + on_face(U0, V_BTN - 12.25, P_W, Box(8, 7.5, MX_PLATE, align=MIN_TOP))                 # bottom rail, centre tab
plate -= [on_face(u, V_BTN, 0, Box(MX_CUT, MX_CUT, 200)) for u in key_u]
plate -= [on_face(u, v - KEYHOLE[0], 0, Cylinder(KEYHOLE[2] / 2 + 0.2, 200)) + on_face(u, v, 0, Cylinder(KEYHOLE[1] / 2 + 0.1, 200))
          + on_face(u, v - KEYHOLE[0] / 2, 0, Box(KEYHOLE[1] + 0.2, KEYHOLE[0], 200)) for u, v in plate_posts]   # keyholes, big end below
# ---- protective window (v5, user/ux): 3 mm low-haze anti-glare PC ON the face, its back on the face's outer surface
# OUTSIDE the glass outline (a 0.3 relief over the glass outline keeps it off the skin there, so a hit goes into the
# case, not the panel), WIN[1] of air to the glass, a flush printed rim on 3 sides (none at the bottom: the LED bar), all
# held by thin double-sided tape on the face. The view opening in the 0.6 skin over the glass border frames the active area.
GL_L, GL_B = U_GL - GLASS[0] / 2, V_GLASS - GLASS[1] / 2      # glass left edge (u, seen from the front), bottom edge (v)
GL_T = GL_B + GLASS[1]
WIN_U, WIN_V = (GL_L - WIN[2], GL_L + GLASS[0] + WIN[2]), (GL_B - WIN[3], GL_T + WIN[2])   # window outline
WIN_SIZE = (WIN_U[1] - WIN_U[0], WIN_V[1] - WIN_V[0])
win_c = (sum(WIN_U) / 2, sum(WIN_V) / 2)
window = on_face(*win_c, 0, extrude(RectangleRounded(*WIN_SIZE, WIN[5]), WIN[0]))
rim_outline = RectangleRounded(WIN_SIZE[0] + 0.5 + 3.2, WIN_SIZE[1] + 0.5 + 3.2, WIN[5] + 1.85) \
    - RectangleRounded(WIN_SIZE[0] + 0.5, WIN_SIZE[1] + 0.5, WIN[5] + 0.25)
rim = on_face(*win_c, -0.3, extrude(rim_outline, WIN[4] + 0.3))                # sits 0.3 deep in its own pocket: self-locating
rim -= on_face(win_c[0], WIN_V[0] - 50, -1, Box(500, 100, 50, align=MINB))      # 3 sides: open at the bottom
body -= on_face(*win_c, -0.3, extrude(offset(rim_outline, 0.15), 0.31)) - on_face(win_c[0], WIN_V[0] - 50, -1, Box(500, 100, 50, align=MINB))
# the rim is a separate print (the shell prints face down, so nothing may stand proud of the face), taped on with the window
body -= on_face(U_GL, V_GLASS, 0.01, Box(GLASS[0] + CLR + 1.0, GLASS[1] + CLR + 1.0, 0.31, align=MIN_TOP))   # relief over the glass
view = (ACTIVE[0] + 2 * WIN_VIEW[0], ACTIVE[1] + 2 * WIN_VIEW[1])
body -= on_face(U0, V_ACT, 0, Box(*view, 20))                                     # view opening = active + margins
# the window's border is masked matte black on its back (vinyl or paint), leaving an aperture = the view opening, centred on
# the ACTIVE area (follows ACTIVE_DX / ACTIVE_BOTTOM): the window is sized to the panel glass, whose border is 10.3 on the
# FPC edge (up) and 3.1 elsewhere, so unmasked it would frame the image off-centre.
win_mask = on_face(*win_c, -0.05, extrude(RectangleRounded(*WIN_SIZE, WIN[5]), 0.05)) - on_face(U0, V_ACT, -1, Box(*view, 5))
APERTURE = ((U0 - view[0] / 2) - WIN_U[0], WIN_U[1] - (U0 + view[0] / 2),            # mask widths from the window's edges:
            WIN_V[1] - (V_ACT + view[1] / 2), (V_ACT - view[1] / 2) - WIN_V[0])     # left, right, top, bottom
body -= on_face(U_GL, V_GLASS, -WIN[1], Box(GLASS[0] + CLR, GLASS[1] + CLR, WALL, align=MIN_TOP))   # glass recess, from inside

x0, x1, z0, z1 = WALL + CLR / 2, W - WALL - CLR / 2, WALL + CLR / 2, H - WALL - CLR / 2   # cover lip outline
cover = box(0, W, DEPTH, DEPTH + WALL, 0, H) + box(x0, x1, DEPTH - 4, DEPTH, z0, z1) \
    - box(x0 + 1.6, x1 - 1.6, DEPTH - 5, DEPTH, z0 + 1.6, z1 - 1.6)          # friction lip ring
rib = lambda x, z: Pos(x, DEPTH - 2, z) * Rot(90, 0, 0) * Cylinder(RIB[0] / 2, 4)   # noqa: E731, along y
k = RIB[0] / 2 - CLR / 2 - RIB[1]          # rib centre inside the lip face: stands proud by gap + interference
cover += [rib(x, z) for x in (W / 3, 2 * W / 3) for z in (z0 + k, z1 - k)]
cover += [rib(x, z) for x in (x0 + k, x1 - k) for z in (H / 3, 2 * H / 3)]
cover -= box(W / 2 - 15, W / 2 + 15, DEPTH + WALL - 1.2, DEPTH + WALL + 1, H - 12, H - 4)   # finger grip

# ---- glass retainer = full-area BACKING (v5, lead): a plate on the face's inner surface with a pocket for 1 mm foam
# behind the whole panel. It bottoms on the face; the foam holds the panel lightly against the skin over its border, and
# if a hard hit pushes the window onto the panel, the panel is pressed flat onto the backing (compression, no bending).
out_side, out_bot, out_top = 4.0, 2.5, 4.0                     # frame beyond the glass; the bottom stays clear of the key guides
pins = [(U_GL + sx * (GLASS[0] / 2 + 2.5), v) for sx in (-1, 1) for v in (GL_B + 4, GL_T - 12)]   # lower pins clear of the NFC tags' drop path
body += [on_face(u, v, -WALL, Cylinder(PIN_D / 2, 3.5, align=MIN_TOP)) for u, v in pins]
fpc_uc = GL_L + FPC_ROOT[1] + FPC_ROOT[0] / 2
body -= on_face(fpc_uc, GL_T + 2, -WIN[1], Box(FPC_ROOT[0] + 1, 4, WALL, align=MIN_TOP))   # FPC bend pocket
frame = on_face(U_GL, (GL_B - out_bot + GL_T + out_top) / 2, -WALL,
                Box(GLASS[0] + 2 * out_side, GLASS[1] + out_bot + out_top, FRAME_T, align=MIN_TOP))
frame -= on_face(U_GL, V_GLASS, -WALL + 0.01, Box(GLASS[0] + CLR, GLASS[1] + CLR, FOAM_P[1] - (WALL - WIN[1] - GLASS[2]) + 0.01,
                                                 align=MIN_TOP))   # foam pocket: FOAM_P[1] behind the panel
frame -= on_face(fpc_uc, GL_T, 0, Box(FPC_ROOT[0] + 1, 2 * out_top + 2, 20))        # FPC passes through and bends back
frame -= [on_face(u, v, 0, Cylinder(2.75 / 2, 20)) for u, v in pins]
# adapter (review B6): plug the FPC into its ZIF in hand, then drop the board onto 2 pads on the frame's back
# (foam tape), located by 2 corner tabs at its ZIF edge. Its bottom (header) edge stays free for the wires.
ad_uc = GL_L + FPC_TAIL[1] + FPC_TAIL[0] / 2                   # ZIF under the FPC tail
FPC_BEND_R, ZIF_IN = FRAME_T / 2 + 1.0, 3.5                  # fold radius around the frame edge; tail insertion into the ZIF
ad_vt = GL_T + 1.0 - (FPC_TAIL[2] - 1.0 - math.pi * FPC_BEND_R) + ZIF_IN   # ZIF edge: where the folded tail ends, plus insertion
ad_w = -WALL - FRAME_T - ADAPTER_ENV[0]                        # board front (ZIF faces the frame)
ad_vc = ad_vt - ADAPTER[1] / 2
for su in (-1, 1):
    frame += on_face(ad_uc + su * (ADAPTER[0] / 2 - 4), ad_vc, -WALL - FRAME_T, Box(6, 8, ADAPTER_ENV[0] - 0.5, align=MIN_TOP))   # pad (tape adds 0.5)
    frame += on_face(ad_uc + su * (ADAPTER[0] / 2 + 0.9), ad_vt - 3, -WALL - FRAME_T, Box(1.2, 6, ADAPTER_ENV[0] + ADAPTER[2] + 1, align=MIN_TOP))   # locator
adapter_board = on_face(ad_uc, ad_vc, ad_w, Box(ADAPTER[0], ADAPTER[1], ADAPTER[2], align=MIN_TOP))
adapter = adapter_board + on_face(ad_uc, ad_vt - 2, ad_w + ADAPTER_ENV[0], Box(30, 4, ADAPTER_ENV[0], align=MIN_TOP)) \
    + on_face(ad_uc, ad_vt - ADAPTER[1] + ADAPTER_ENV[2] / 2, ad_w - ADAPTER[2], Box(ADAPTER[0], ADAPTER_ENV[2], ADAPTER_ENV[1], align=MIN_TOP))
ad_wires = on_face(ad_uc, ad_vt - ADAPTER[1] - 10, ad_w - ADAPTER[2], Box(22, 20, 4, align=MIN_TOP))   # wire bundle leaving the header edge

# printed cap (top face down on the bed): 16 x 11 body from the skirt to 3 proud, 0.8 chamfer on the top edges, an MX
# cross socket in a Ø5.5 tube that sits on the slider face
W_SLIDER = P_W + MX_STEM[0]
key_cap = chamfer((Pos(0, 0, KEY[2]) * Box(KEY[0], KEY[1], KEY[2] - W_CAP, align=MIN_TOP)).edges().group_by(Axis.Z)[-1], 0.8)
key_cap += Pos(0, 0, W_CAP) * Cylinder(2.8, W_CAP - W_SLIDER, align=MIN_TOP)


def cross(clr, depth):                    # MX cross socket (arms + clearance), from z 0 up
    a, b = MX_STEM[2] + 2 * clr, MX_STEM[3] + 2 * clr
    return Box(a, b, depth, align=MINB) + Box(b, a, depth, align=MINB)


key_cap -= Pos(0, 0, W_SLIDER) * cross(STEM_CLR, MX_STEM[1] - MX_STEM[0] + 0.3)
# stem-fit test: 4 sockets, clearance 0.05 / 0.10 / 0.15 / 0.20 per side (1-4 engraved), sockets up: try each on a switch
STEM_TRY = (0.05, 0.10, 0.15, 0.20)
stemtest = Box(4 * 12 + 2, 10, 1.0, align=(Align.MIN, Align.CENTER, Align.MIN))
for i, c in enumerate(STEM_TRY):
    stemtest += Pos(6 + 12 * i, 0, 0) * Cylinder(3.2, 5.0, align=MINB)
    stemtest -= Pos(6 + 12 * i, 0, 5.0 - (MX_STEM[1] - MX_STEM[0] + 0.3)) * cross(c, 10)
    stemtest -= Pos(6 + 12 * i - 1.6, -4.6, 1.0) * extrude(Text(str(i + 1), font_size=3.0, align=(Align.MIN, Align.MIN)), -0.4)

# placeholders, for the fit check and the renders
caps = [on_face(u, V_BTN, 0, key_cap) for u in key_u]
switches = [on_face(u, V_BTN, P_W + MX_TOP[1], Box(MX_TOP[0], MX_TOP[0], MX_TOP[1], align=MIN_TOP)
                                                  - Box(7.2, 7.2, 10, align=MIN_TOP))   # slider opening: the cap's stem tube rides into it
            + on_face(u, V_BTN, P_W, Box(MX_BOT[0], MX_BOT[0], MX_BOT[1], align=MIN_TOP)) for u in key_u]   # housings
stems = [on_face(u, V_BTN, W_SLIDER, Box(7.0, 7.0, W_SLIDER - P_W - MX_TOP[1], align=MIN_TOP)) for u in key_u]  # slider above the housing
wiring = on_face(U0, V_BTN + 2.5, P_W - MX_BOT[1], Box(3 * KEY_PITCH + 20, 9.0, MX_PIN + WIRING, align=MIN_TOP))
strip = on_face(U0, LED_V, W_STRIP, Box(STRIP[0], STRIP[1], STRIP[2], align=MIN_TOP))
strip -= [on_face(U0 + sx * STRIP_HOLE[0], LED_V + STRIP_HOLE[2], 0, Cylinder(STRIP_HOLE[1] / 2, 200)) for sx in (-1, 1)]   # its 2 pin holes
glass = on_face(U_GL, V_GLASS, -WIN[1], Box(*GLASS, align=MIN_TOP))
paper = on_face(U0, V_ACT, -WIN[1] - 0.3, Box(ACTIVE[0], ACTIVE[1], 0.1, align=MIN_TOP))
foam_p = on_face(U_GL, V_GLASS + 1.0, -WIN[1] - GLASS[2], Box(GLASS[0] - 2, GLASS[1] - 3, FOAM_P[1], align=MIN_TOP))   # clear of the LED baffles' tops

# ---- main-board cradle on the floor, under the battery shelf: the goal insert's cradle (review B4, S1, S2).
# Board coordinates as in electronics/dimensions.md: x from the USB-C end (v5: USB_CLEAR in from the left wall, so the
# extension's male plug goes straight into the XIAO; its female end is panel-mounted in the back cover), y from the
# header edge. Supports only on joint-free zones: the
# end rail (x 0.5-4), the 1.5 mm edge strips and the 2 pin bosses. No screws; the LIS3DH needs it rigid.
MB_HOLE_Y, MB_PIN_X, MB_EDGE, MB_RAIL = (3.5, 26.5), 66.5, 1.5, (0.5, 4.0)
MB_LIP_X, MB_CLIP_X = (25.0, 60.0), (25.0, 63.0)   # lips on the header edge clear of J_KEY/J_BAT (MB_HDR_X); clips clear of J_EPD (32.4-52.8), R_KEY (56.6-59.1)
MB_C = 6.5                                          # board underside above the floor: joints + a 10 mm clip beam
mb_x0, mb_yb = WALL + USB_CLEAR, DEPTH - 4.5 - 2.5   # USB-C end x; header-edge y: under the battery shelf, clear of the cover lip
mb_yf = mb_yb - BOARD[0]                            # front (J_EPD) edge
mb_bot = WALL + MB_C
mb_top = mb_bot + 1.6


def gx(x):                                # board x -> global x
    return mb_x0 + x


def gy(by):                               # board y -> global y; with gx a ROTATION (components up, review B11):
    return mb_yf + by                     # header edge (y=0) at the FRONT, socket/J_EPD edge at the back


pin_xy = [(gx(MB_PIN_X), gy(hy)) for hy in MB_HOLE_Y]
for px, py in pin_xy:
    body += Pos(px, py, WALL - 0.5) * Cylinder(3.5, MB_C + 0.5, align=(Align.CENTER, Align.CENTER, Align.MIN))
body += Pos(gx(MB_PIN_X), gy(3.5), mb_bot) * Cylinder(1.4, 1.2, align=(Align.CENTER, Align.CENTER, Align.MIN))   # one locating pin, clip (front) side (review B8)
body += box(gx(MB_RAIL[0]), gx(MB_RAIL[1]), mb_yf, mb_yb, WALL - 0.5, mb_bot)    # end rail under the USB-C end
for x in MB_LIP_X:   # fixed lip over the header edge (with its edge ledge below); 0.4 crush bump clamps the board
    body += box(gx(x) - 5, gx(x) + 5, mb_yb + 0.2, mb_yb + 2.0, WALL - 0.5, mb_top + 2.2)
    body += box(gx(x) - 5, gx(x) + 5, mb_yb - 1.0, mb_yb + 2.0, mb_top + 0.3, mb_top + 2.2)
    body += box(gx(x) - 5, gx(x) + 5, mb_yb - MB_EDGE, mb_yb, WALL - 0.5, mb_bot)
    body += box(gx(x) - 1, gx(x) + 1, mb_yb - 0.8, mb_yb - 0.2, mb_top - 0.25, mb_top + 0.3)
for x in MB_CLIP_X:  # snap clip on the front edge: beam rooted in a floor pocket (10 mm free), hook, release tab
    body -= box(gx(x) - 3.6, gx(x) + 3.6, mb_yf - 0.2 - CLIP_T - 1.2, mb_yf - 0.2 + 0.6, 1.5, WALL + 0.1)   # 1.5 mm root skin
    body += box(gx(x) - 3, gx(x) + 3, mb_yf - 0.2 - CLIP_T, mb_yf - 0.2, 1.5, mb_top + 5)   # short release tab: reached from the open back
    body += Pos(gx(x) - 3, 0, 0) * extrude(Plane.YZ * Polygon(
        (mb_yf - 0.2, mb_top + 0.3), (mb_yf + HOOK, mb_top + 0.3), (mb_yf - 0.2, mb_top + 2.3), align=None),
        6, dir=(1, 0, 0))                                                        # explicit dir: winding-proof
    body += box(gx(x) - 1, gx(x) + 1, mb_yf + 0.1, mb_yf + HOOK - 0.1, mb_top - 0.25, mb_top + 0.3)   # crush bump
    body += box(gx(x) - 3, gx(x) + 3, mb_yf, mb_yf + MB_EDGE, WALL - 0.5, mb_bot)                  # edge ledge
# battery on a shelf above the board's 14 mm component space
MB_HDR_X, PLUG_H = (4.5, 17.2), 22.0     # J_KEY/J_BAT housings on the FRONT (header) edge; Dupont plug height
SHELF_Z = mb_top + 14 + 0.5 + SHELF_T    # back edge has only the 14 mm keep-out (J_EPD is soldered wires, <= 3 mm)
BAT_X1 = 87.0                               # holder's right end: AA cells >= 20 from the RC522 loop (electronics v5)
bat = box(BAT_X1 - BAT[0], BAT_X1, BAT_Y0, BAT_Y0 + BAT[1], SHELF_Z, SHELF_Z + BAT[2])
# The shelf is a separate drop-in part (review B10): the board rolls in from above first, then the shelf sits on a
# wall on the right and 2 posts at the left (one located by a pin), held down by the holder and the cover rib.
SHELF_Y0 = BAT_Y0 - 2.0
SH_X0 = BAT_X1 - BAT[0] - 1.0                      # shelf's left edge, under the holder's left end
post_rx = gx(BOARD[1]) + 2.0                       # right post, beside the board's end
body += box(post_rx - 1.5, post_rx + 1.5, SHELF_Y0, DEPTH - 5, WALL - 0.5, SHELF_Z - SHELF_T)   # under the shelf's right edge
post_x = SH_X0 + 1.5
post_y = (DEPTH - 12.0,)                          # left post: behind the USB plug's path
for py in post_y:
    body += box(post_x - 1.5, post_x + 1.5, py, py + 6, WALL - 0.5, SHELF_Z - SHELF_T)
body += Pos(post_x, post_y[0] + 3, SHELF_Z - SHELF_T) * Cylinder(1.25, 1.8, align=(Align.CENTER, Align.CENTER, Align.MIN))
shelf = box(SH_X0, post_rx + 1.5, SHELF_Y0, DEPTH - 4.6, SHELF_Z - SHELF_T, SHELF_Z)
shelf -= Pos(post_x, post_y[0] + 3, 0) * Cylinder(1.45, 200)                    # locating hole over the post pin
usb_y, usb_z = gy(16.1), mb_top + 5.7                                            # the XIAO's port (faces -x)
usb_plug = box(mb_x0 + 1.4 - USB_PLUG[2], mb_x0 - 0.1, usb_y - USB_PLUG[0] / 2, usb_y + USB_PLUG[0] / 2,   # (its last 1.5 over the board edge)
               usb_z - USB_PLUG[1] / 2, usb_z + USB_PLUG[1] / 2)                 # the extension's right-angle male end
bx0, bx1 = bat.bounding_box().min.X, bat.bounding_box().max.X
fence = box(bx0 - 2, bx1 + 2, BAT_Y0 - 2, DEPTH - 4.5, SHELF_Z - 0.5, SHELF_Z + 6) \
    - box(bx0 - 0.5, bx1 + 0.5, BAT_Y0 - 0.5, DEPTH, SHELF_Z, SHELF_Z + 7)
fence -= box(bx0 - 3, bx0, BAT_Y0 + 4, BAT_Y0 + 13, SHELF_Z, SHELF_Z + 7)            # lead notch at the left end, toward J_BAT (review S6)
shelf += fence                                                                   # locating pocket for the upright holder
cover += box(bx0 + 10, bx1 - 10, BAT_Y0 + BAT[1] + 0.3, DEPTH, SHELF_Z + BAT[2] - 8, SHELF_Z + BAT[2] - 3)   # holds the holder upright (S6)
# USB-C extension's female end, panel-mounted in the back cover (lead/electronics): flange inside the cover on 2 printed
# bosses (self-tapping M2.5), socket through a cutout. Low on the left, beside the holder: the cable loops forward to
# the male end at the XIAO (>= 15 bend radius), away from the RC522 in the right wing.
USB_XZ = (102.0, WALL + 33.0)                       # right of the holder, left of the speaker cup; flange vertical
uw, uh = USB_EXT[1] / 2, USB_EXT[0] / 2             # flange vertical: 9 wide, 28 tall
for sx in (-1, 1):                                  # printed clip: 2 side rails with lips over the flange's edges, a bottom stop;
    cover += box(USB_XZ[0] + sx * (uw + 0.2), USB_XZ[0] + sx * (uw + 1.4), DEPTH - USB_EXT[2] - 1.4, DEPTH,      # the flange drops
                 USB_XZ[1] - uh - 1.6, USB_XZ[1] + uh)                                                             # in from above
    cover += box(USB_XZ[0] + sx * (uw - 0.8), USB_XZ[0] + sx * (uw + 1.4), DEPTH - USB_EXT[2] - 1.4, DEPTH - USB_EXT[2] - 0.2,   # lips 0.8 over (S20)
                 USB_XZ[1] - uh - 1.6, USB_XZ[1] + uh)
cover += box(USB_XZ[0] - uw - 1.4, USB_XZ[0] + uw + 1.4, DEPTH - USB_EXT[2] - 1.4, DEPTH, USB_XZ[1] - uh - 1.6, USB_XZ[1] - uh - 0.2)
cover -= box(USB_XZ[0] - USB_EXT[5] / 2, USB_XZ[0] + USB_EXT[5] / 2, DEPTH - 1, DEPTH + WALL + 1, USB_XZ[1] - USB_EXT[4] / 2, USB_XZ[1] + USB_EXT[4] / 2)
usb_flange = box(USB_XZ[0] - uw, USB_XZ[0] + uw, DEPTH - USB_EXT[2], DEPTH, USB_XZ[1] - uh, USB_XZ[1] + uh)
usb_female = usb_flange + box(USB_XZ[0] - USB_EXT[7] / 2, USB_XZ[0] + USB_EXT[7] / 2, DEPTH - USB_EXT[2] - USB_EXT[8],
                              DEPTH - USB_EXT[2], USB_XZ[1] - USB_EXT[6] / 2, USB_XZ[1] + USB_EXT[6] / 2)
# its cable (Ø5), modelled as a keep-out: it leaves the right-angle male end toward the face, rises in front of the battery
# shelf, then runs across in front of the holder (above the board's plugs) to the socket. Excess coils at the left, away
# from the reader (electronics).
u_x0 = mb_x0 + 1.4 - USB_PLUG[2]                  # the plug's outer end: the cable leaves it toward the face (-y)
usb_cable = box(u_x0, u_x0 + 5.0, usb_y - USB_PLUG[0] / 2 - 9.0, usb_y - USB_PLUG[0] / 2, usb_z - 2.5, usb_z + 2.5) \
    + box(u_x0, u_x0 + 5.0, usb_y - USB_PLUG[0] / 2 - 9.0, usb_y - USB_PLUG[0] / 2 - 4.0, usb_z, SHELF_Z + 15.0) \
    + box(u_x0, USB_XZ[0] + 3, BAT_Y0 - 9.0, BAT_Y0 - 3.5, SHELF_Z + 8.0, SHELF_Z + 15.0)   # forward, up in front of the
                                                                                              # shelf, then across to the socket
board = box(gx(0), gx(BOARD[1]), mb_yf, mb_yb, mb_bot, mb_top)                   # the perfboard itself
board_keepout = box(gx(0), gx(BOARD[1]), mb_yf + MB_EDGE, mb_yb - MB_EDGE, mb_top, mb_top + 14.0)
board_under = box(gx(MB_RAIL[1]), gx(BOARD[1]), mb_yf + MB_EDGE, mb_yb - MB_EDGE, mb_bot - MB_UNDER, mb_bot) \
    - [Pos(px, py, 0) * Cylinder(3.6, 60) for px, py in pin_xy]

# ---- NFC: an on-metal tag inside the left side wall (v3: the right one would sit in the RFID field), in a
# locating ring (recess = tag + 0.3), read through the
# 2.5 mm wall; it can't be peeled off. Outside, exactly over the tag centre, a raised contactless glyph (ux):
# dot + 3 arcs opening away from the face, ~18 wide, 0.6 proud.
from build123d import Circle, Rectangle, RectangleRounded, SlotOverall, Text   # noqa: E402
glyph = Circle(1.3)
for r in (4.0, 7.0, 10.0):
    glyph += (Circle(r + 0.7) - Circle(r - 0.7)) & Polygon((0, 0), (16, -16), (16, 16), align=None)   # opens toward +y (back)
g_bb = glyph.bounding_box()
glyph = Pos(-(g_bb.min.X + g_bb.max.X) / 2, -(g_bb.min.Y + g_bb.max.Y) / 2) * glyph   # bbox centred on the tag centre
for x_wall, x_in, sgn, nyz in ((0, WALL, -1, NFC_YZ),):        # left wall only: the right tag would sit in the reader's field
    ring = (Cylinder(NFC[0] / 2 + 0.25 + 1.2, NFC[1] + 0.3, align=(Align.CENTER, Align.CENTER, Align.MIN))
            - Cylinder(NFC[0] / 2 + 0.25, 5, align=(Align.CENTER, Align.CENTER, Align.MIN)))
    body += Pos(x_in, *nyz) * Rot(0, -90 * sgn, 0) * ring                               # locating ring inside
    body += Pos(x_wall, 0, 0) * Rot(0, 0, 0) * extrude(Plane.YZ.offset(0) * Pos(*nyz) * glyph, 0.6 * sgn)
XCYL = lambda x, y, z, r, h: Pos(x, y, z) * Rot(0, 90, 0) * Cylinder(r, h, align=(Align.CENTER, Align.CENTER, Align.MIN))   # noqa: E731
# ---- sound: option A, the speaker (user 2026-10-15), or option B, the buzzer in a disc, both behind ONE grille on the RIGHT
# (outer) wall, back-low: as far from the RC522 loop as the wall allows (electronics: magnet/frame >= 25). A 40 mm
# round speaker presses into the mouth of a printed back cup (crush ribs, rim on the cup's shoulder), which closes the
# back volume behind it, so the case's key gaps and USB opening don't leak into it. The unit's front (speaker rim + cup
# rim, flush) sticks to the wall with a double-sided foam ring inside a LOW locating lip: the glass, frame and LED strip
# come in from the back within 2.5 of this wall, so nothing here may stand proud of it by more than 1.5.
# Grille holes and ring axes lie along x: horizontal in the face-down print, no supports. The amp lies flat on the floor
# under the cup, on foam tape (its bay is a keep-out, no fixings: the board size varies by clone).
WALL_IN = W - WALL                                    # the right wall's inner face
_r_cup = (SPK[1] + 0.4 + 2 * CUP[1]) / 2
SPK_YZ = (DEPTH - 4.5 - _r_cup - 0.3, WALL + _r_cup + 0.3)   # back-low corner of the outer wall (the lip is cut by the floor
                                                              # and the cover's lip zone there)


def xslab(x0, x1, wy, hz, yz=SPK_YZ):     # rounded-rect slab (round if wy == hz) from x0 to x1, axis along x
    return Pos(x0, *yz) * Rot(0, 90, 0) * extrude(RectangleRounded(hz, wy, min(wy, hz) / 2 - 0.01), x1 - x0)


X_F = WALL_IN - FOAM                                  # speaker + cup front plane, on the foam ring
X_SH = X_F - SPK[3]                                   # speaker rim's back face = the cup's shoulder
mouth = (SPK[0] + 0.4, SPK[1] + 0.4)
cup_out = (mouth[0] + 2 * CUP[1], mouth[1] + 2 * CUP[1])
ring_in = (cup_out[0] + 2 * CUP[2], cup_out[1] + 2 * CUP[2])
ring_out = (ring_in[0] + 2.4, ring_in[1] + 2.4)
H_RING = FOAM + 0.5                                   # locating lip: the foam ring + 0.5 of the cup
body += (xslab(WALL_IN - H_RING, WALL_IN + 0.1, *ring_out) - xslab(WALL_IN - 10, WALL_IN + 0.2, *ring_in)) \
    & box(0, W, 0, DEPTH - 4.5, WALL - 0.5, H)
cone = ((SPK[0] - 10) / 2, (SPK[1] - 10) / 2)          # open area over the cone (semi-axes)
SPK_GRILLE = [(dy, dz) for j in range(-12, 13) for i in range(-12, 13)
          for dy, dz in [((i + (j % 2) / 2) * GRILLE_HOLE[1], j * GRILLE_HOLE[1] * math.sqrt(3) / 2)]
          if (dy / (cone[0] - GRILLE_HOLE[0] / 2)) ** 2 + (dz / (cone[1] - GRILLE_HOLE[0] / 2)) ** 2 <= 1]
body -= [XCYL(WALL_IN - 1, SPK_YZ[0] + dy, SPK_YZ[1] + dz, GRILLE_HOLE[0] / 2, WALL + 2) for dy, dz in SPK_GRILLE]
speaker = xslab(X_SH, WALL_IN - FOAM, SPK[0], SPK[1]) + xslab(WALL_IN - FOAM - SPK[2], X_SH, 0.6 * SPK[0], 0.6 * SPK[1])
cav = (SPK[0] - 3, SPK[1] - 3)                        # behind the shoulder: the back volume
X_CUP0 = X_SH - CUP[0] - CUP[1]                       # cup bottom's outer face
cup_body = xslab(X_CUP0, X_F, *cup_out) - xslab(X_SH, X_F + 0.01, *mouth) - xslab(X_SH - CUP[0], X_SH + 0.01, *cav)
WIRE_HOLE = (X_CUP0, SPK_YZ[0], SPK_YZ[1] - cav[1] / 2 + 4)
cup_body -= XCYL(X_CUP0 - 1, *WIRE_HOLE[1:], 1.75, CUP[1] + 2)                   # speaker leads out (hot glue seals it)
cup_ribs = [XCYL(X_SH, SPK_YZ[0] + s_ * (mouth[0] / 2 + 0.15), SPK_YZ[1], 0.5, SPK[3]) for s_ in (-1, 1)] \
    + [XCYL(X_SH, SPK_YZ[0], SPK_YZ[1] + s_ * (mouth[1] / 2 + 0.15), 0.5, SPK[3]) for s_ in (-1, 1)]
cup = cup_body + cup_ribs                             # ribs in the mouth: 0.15 interference on the speaker's rim
# option B: the buzzer push-fits in a ring on a disc of the speaker's outline, taped into the same lip with the same foam
buzz_disc = xslab(X_SH, X_F, SPK[0] - 0.3, SPK[1] - 0.3) + XCYL(X_SH - 4, *SPK_YZ, BUZZ[0] / 2 + 0.15 + 1.2, 4)
buzz_disc -= XCYL(X_SH - 5, *SPK_YZ, BUZZ[0] / 2 + 0.15, 20)
buzzer = XCYL(X_F - BUZZ[1], *SPK_YZ, BUZZ[0] / 2, BUZZ[1]) + XCYL(X_F - BUZZ[1] - 6, *SPK_YZ, 4.5, 6)   # + pins/lead joints
AMP_Z = WALL + 1.0                                    # PCB underside: 1 mm foam tape on the floor
AMP_XY = (W_MAIN + 1.0, WALL + 2.0)                   # v5: the wing's floor, in front of the speaker, under the reader
ax0, ay0 = AMP_XY
ax1, ay1 = ax0 + AMP[0], ay0 + AMP[1]
amp = box(ax0, ax1, ay0, ay1, AMP_Z, AMP_Z + AMP[2] + AMP[3]) \
    + box(ax0 + 2, ax1 - 2, ay0 - 1, ay0 + 5, AMP_Z + AMP[2], AMP_Z + AMP[2] + 8) \
    + Pos(ax0 + 1, ay1 + 1 + CAP470[0] / 2, AMP_Z + CAP470[0] / 2) * Rot(0, 90, 0) * Cylinder(CAP470[0] / 2, CAP470[1], align=MINB)
J_AMP = ((26.1, 31.2), 13.6)                         # electronics' perfboard: J_AMP x span, y (mm, board coordinates); no header:
                                                      # 3 wires soldered straight in, leaving up (6 mm of joints + bends, like J_EPD)
shelf -= box(gx(J_AMP[0][0]) - 1.5, gx(J_AMP[0][1]) + 1.5, BAT_Y0 - 3, BAT_Y0 - 0.2, -1, 200)   # spare room over J_AMP's wires

# ---- LEDs + diffuser (v4): the 4 RGB LEDs sit flush on the LED strip, one above each key, and shine into one
# bought 2 mm opal acrylic bar (glossy, cut to length) in a pocket from the inside, behind 0.7 ledges. The MIX gap
# evens the 4 spots out. A light box keeps the light off the e-paper and in the bar: the sleeves' tops are its floor
# and a fin on the retainer frame's back is its roof (in the shell it would cross the glass's and frame's
# way in). It ends with the sleeves (the domes are 0.7 behind), clear of the caps' way in.
# The retainer frame's bottom edge holds the bar's top edge (0.3 relief); glue dots hold its ends.
pocket = (DIFF[0] + 0.4, DIFF[1] + 0.4)
body -= on_face(U0, DIFF_V, -DIFF_LIP, Box(*pocket, WALL, align=MIN_TOP))                  # the bar's pocket
body -= on_face(U0, DIFF_V, 1, Box(pocket[0] - 1.4, pocket[1] - 1.4, 3, align=MIN_TOP))     # visible slot: 0.7 ledges
W_LED = W_STRIP + LED[4]                                                                   # flange plane
lb_top = LED_V + LED[1] / 2 + 0.6                                                          # light box roof (inside)
lb_bot = DIFF_V - pocket[1] / 2                                                            # floor = pocket bottom
body += on_face(U0, lb_bot - 0.6, -WALL + 0.1, Box(pocket[0] + 2.4, 1.2, -WALL + 0.1 - (W_CAP - CAP_STOP + 0.3), align=MIN_TOP))   # floor, to the housings
frame += on_face(U0, lb_top + 0.6, -WALL - FRAME_T + 0.1, Box(pocket[0] + 1.0, 1.2, max(1.5, MIX / 2 - FRAME_T), align=MIN_TOP))   # roof fin: to where
# the domes' 60 deg cone reaches it (~6 in front of them); deeper it would sweep the PCA9685 as the frame comes in
BAFFLE = (1.0, MIX - 2.0)                # opaque baffles at the 3 key boundaries (ux: neighbouring colours stay apart): t, depth
baffle_u = [U0 + (i - (KEYS - 2) / 2) * KEY_PITCH for i in range(KEYS - 1)]
bf_v0 = (lb_bot + 0.3, LED_V - 3.7)       # baffle bottom: full height for the first 3 mm behind the bar, then only where
for u in baffle_u:                         # an LED's rays cross (clears the strip's top edge as the frame comes in)
    for v0, w0, d in ((bf_v0[0], -DIFF_LIP - DIFF[2], 3.0), (bf_v0[1], -DIFF_LIP - DIFF[2] - 3.0, BAFFLE[1] - 3.0)):
        frame += on_face(u, (v0 + lb_top + 1.2) / 2, w0, Box(BAFFLE[0], lb_top + 1.2 - v0, d, align=MIN_TOP))
frame -= on_face(U0, DIFF_V, -WALL, Box(*pocket, 0.3, align=MIN_TOP))                       # relief over the bar
diffuser = on_face(U0, DIFF_V, -DIFF_LIP - 0.1, Box(*DIFF[:2], DIFF[2] - 0.2, align=MIN_TOP))   # -0.2 tolerance band
leds = [on_face(u, LED_V, W_STRIP, Cylinder(LED[1] / 2, LED[4] + LED[2], align=MINB))
        + on_face(u, LED_V, W_LED + LED[2], Cylinder(LED[0] / 2, LED[3] - LED[2], align=MINB)) for u in key_u]
led_stubs = [on_face(u, LED_V, W_STRIP - STRIP[2], Box(6, 6, LED_STUB, align=MIN_TOP)) for u in key_u]

# ---- PCA9685 (v5): STANDS on its long edge in 2 floor slots, between the key stack and the main board's clips, parts
# toward the face, wires up off its top edge (to the LED strip; LED5's 4 to the wing). Slots allow the +/-1 mm clone outline.
PLATE_REACH = max(x.bounding_box().max.Y for x in [plate, wiring] + switches) + PLATE_TRAVEL * math.sin(_T)
PCA_Y = 45.3                              # PCB's front (parts) face: behind the LED stubs, in front of the board clips
PCA_Z = WALL + 0.5                        # its bottom edge, in the slots
pca_x0 = (mb_x0 + BAT_X1) / 2 - PCA[0] / 2
pca_x1 = pca_x0 + PCA[0]
for x in (pca_x0 - PCA[5] - 0.3, pca_x1 + PCA[5] + 0.3):
    sx = -1 if x < pca_x0 else 1
    body += box(x, x + sx * 2.0, PCA_Y - 2.2, PCA_Y + PCA[2] + 1.2, WALL - 0.5, PCA_Z + 8.0) \
        - box(x - sx * 1.0, x + sx * 1.0, PCA_Y - 0.15, PCA_Y + PCA[2] + 0.15, PCA_Z - 0.5, PCA_Z + 9.0)   # end slot
pca = box(pca_x0, pca_x1, PCA_Y, PCA_Y + PCA[2], PCA_Z, PCA_Z + PCA[1]) \
    + box(pca_x0 + 3, pca_x1 - 3, PCA_Y - PCA[3], PCA_Y, PCA_Z + 3, PCA_Z + PCA[1] - 3) \
    + box(pca_x0 + 4, pca_x1 - 4, PCA_Y + PCA[2], PCA_Y + PCA[2] + PCA[4], PCA_Z + 4, PCA_Z + PCA[1] - 4) \
    + box(pca_x0 + 2, pca_x1 - 2, PCA_Y - 1, PCA_Y + 4, PCA_Z + PCA[1], PCA_Z + PCA[1] + 5)   # PWM wires up off the top edge

# ---- RFID reader (v5, ux/electronics): in the RIGHT wing, parallel to the face, flat back toward it on 4 printed 0.5
# pads + 1 mm foam tape, its LOOP END UP (as high as the face allows, away from the speaker), header end down. Its bottom
# edge sits on a ledge (the slope keeps it there). In from the open back, then pressed out onto the pads.
w_rb = -WALL - RC_AIR                                  # the module's flat back (face side)
u_rc = (WIN_U[1] + 0.25 + 1.6 + W - WALL) / 2          # wing centre: between the window's rim and the outer wall
v_le = F - RC_TOP                                      # loop (far) end
v_lc = v_le - RC[4]                                    # loop centre = target centre
v_rb = v_le - RC[1]                                    # header (bottom) end
for v in (v_rb + 4, v_le - 1.4):                    # the top pads sit above the insert's shoulder
    for su in (-1, 1):
        body += on_face(u_rc + su * 15.0, v, -WALL + 0.1, Box(4, 4, RC_AIR - 1.0 + 0.1, align=MIN_TOP))   # pad (tape adds 1)
for su in (-1, 1):
    body += on_face(u_rc + su * 10, v_rb - 0.6, -WALL + 0.1, Box(6, 1.2, RC_AIR + RC[2] - 0.5 + 0.1, align=MIN_TOP))   # bottom ledge
rc522 = on_face(u_rc, (v_rb + v_le) / 2, w_rb, Box(RC[0], RC[1], RC[2], align=MIN_TOP)) \
    + on_face(u_rc, v_rb + 11, w_rb - RC[2], Box(RC[0] - 2, 22, RC[3], align=MIN_TOP)) \
    + on_face(u_rc, v_rb + 2.5, w_rb - RC[2], Box(22, 4.5, 10, align=MIN_TOP))      # chip/crystal; header + 7 wires, leading down
rc_loop = on_face(u_rc, v_le - RC[5] / 2, w_rb - RC[2] + 0.1, Box(RC[0], RC[5], 0.1, align=MIN_TOP))

# ---- badge target (ux v5: on the face, wing, upper half): a translucent insert (natural PETG) flush in a window in the
# face over the loop, ux's ID-badge mark and 'badge' engraved 0.4 into it. Its shoulder (= the reader's air) sits between
# the face and the reader, which holds it flush. Its tongue runs DOWN under a 1 mm skin, past the module's header end, to
# LED5, whose dome is glued into a socket under the tongue's end: LED5 is below the module, never in view, its wires lead
# down and away (electronics: beside the loop >= ~10, nothing across the loop's face).
BADGE = (28.0, 18.0, 0.8, 0.4)             # card outline w, h, line width, engraving depth
card = RectangleRounded(BADGE[0], BADGE[1], 3) - RectangleRounded(BADGE[0] - 2 * BADGE[2], BADGE[1] - 2 * BADGE[2], 2.2)
card += Pos(0, BADGE[1] / 2 - 3) * SlotOverall(6, 1.6)                                     # lanyard slot
card += Pos(-7, 1.2) * Circle(2.2)                                                          # head
card += Pos(-7, -6.2) * (Circle(4.2) & Pos(0, 2.1) * Rectangle(8.4, 4.2))                  # shoulders
import matplotlib   # noqa: E402  (comes with pyvista): its DejaVu Sans Bold is free and on every checkout (ux)
BADGE_FONT = Path(matplotlib.get_data_path()) / "fonts" / "ttf" / "DejaVuSans-Bold.ttf"
if not BADGE_FONT.is_file():
    sys.exit(f"badge font missing: {BADGE_FONT} (refusing to fall back to a thin system font)")
badge_txt = Text("badge", font_size=6.0, font_path=str(BADGE_FONT))   # ~5 mm lower case, strokes >= 0.8 (ux)
mark = Pos(0, 4.0) * card + Pos(0, -8.5) * badge_txt                   # card above, word below, read from the front
LED5_V = v_rb - LED[1] / 2 - 1.5                       # LED5 centre: just below the module's bottom edge
tile = on_face(u_rc, v_lc, 0, extrude(RectangleRounded(TILE[0], TILE[1], 3), -(WALL + TILE[2])))
tile += on_face(u_rc, v_lc, -WALL, extrude(RectangleRounded(TILE[0] + 2 * TILE[3], TILE[1] + 2 * TILE[3], 4), -TILE[2]))   # shoulder
t_v0, t_v1 = LED5_V - 4.0, v_lc - TILE[1] / 2 + 2
tile += on_face(u_rc, (t_v0 + t_v1) / 2, -1.0, Box(14, t_v1 - t_v0, WALL - 1.0 + TILE[2], align=MIN_TOP))   # tongue under a 1 mm skin
tile -= on_face(u_rc, LED5_V, w_rb - 1, Cylinder(2.65, 2.5, align=MINB))              # LED5 socket, 1.5 deep from its back
tile -= on_face(u_rc, v_lc, 0.01, extrude(mark, -BADGE[3] - 0.01))
body -= on_face(u_rc, v_lc, 1, extrude(RectangleRounded(TILE[0] + 0.3, TILE[1] + 0.3, 3.15), -(WALL + 2)))      # window
body -= on_face(u_rc, (t_v0 + t_v1) / 2, -1.0, Box(14.8, t_v1 - t_v0 + 0.8, WALL, align=MIN_TOP))              # tongue recess
LED5_TIP = w_rb + 1.4                                   # dome tip into the socket (0.1 glue gap)
led5 = on_face(u_rc, LED5_V, LED5_TIP, Cylinder(LED[0] / 2, LED[3] - LED[2], align=MIN_TOP)) \
    + on_face(u_rc, LED5_V, LED5_TIP - (LED[3] - LED[2]), Cylinder(LED[1] / 2, LED[2], align=MIN_TOP))
led5_wires = on_face(u_rc - 9, LED5_V, LED5_TIP - LED[3], Box(24, 6, 3, align=MIN_TOP))   # joints, then 4 wires sideways
                                                      # toward the screen section, above the speaker's cup
xiao = box(gx(2.9), gx(23.9), gy(16.1 - 8.9), gy(16.1 + 8.9), mb_top, mb_top + 4.1)

nfc_tags = [Pos(x_in, *nyz) * Rot(0, -90 * sgn, 0)
            * Cylinder(NFC[0] / 2, NFC[1], align=(Align.CENTER, Align.CENTER, Align.MIN))
            for x_in, sgn, nyz in ((WALL, -1, NFC_YZ),)]


def self_check():
    hits = lambda a, b: bool((a & b).solids())   # noqa: E731
    nothing = lambda a, b: (lambda h: not h.solids() or h.volume < 0.05)(a & b)   # noqa: E731
    mb_hit = board & body
    assert not mb_hit.solids() or mb_hit.volume < 20, "main board collides with the shell (beyond its 2 pins)"
    for x in MB_CLIP_X:
        assert hits(body, box(gx(x) - 0.1, gx(x) + 0.1, mb_yf + 0.2, mb_yf + 0.4, mb_top + 0.5, mb_top + 0.7)), \
            "main-board snap hook missing"
        sweep = box(gx(x) - 3, gx(x) + 3, mb_yf - 0.2 - CLIP_T - 1.0, mb_yf - 0.2 - CLIP_T - 0.05, 1.6, mb_top + 5)
        assert nothing(sweep, body), f"main-board clip at x={x} can't flex (plastic in its sweep)"
    strain = 1.5 * CLIP_T * (HOOK + 0.2) / (mb_top + 0.3 - 1.5) ** 2
    assert strain <= 0.02, f"snap clip strain {strain:.1%} > 2 %"
    for x in MB_LIP_X:
        assert hits(body, box(gx(x) - 0.1, gx(x) + 0.1, mb_yb - 0.7, mb_yb - 0.5, mb_top + 0.5, mb_top + 0.7)), \
            "main-board lip missing"
    # ---- keep-outs: joints, wires and plugs never share space with plastic (review; lead) ----
    assert nothing(board_under, body), "plastic in the joint/wire space under the main board"
    roll_in = box(gx(0), gx(BOARD[1]), mb_yf + HOOK + 0.2, mb_yb - 1.2, mb_bot, mb_top + 14)
    roll_in -= Pos(gx(MB_PIN_X), gy(3.5), 0) * Cylinder(1.6, 200)   # its locating pin goes through the hole
    assert nothing(roll_in, body), "main board can't roll in from above (plastic over its footprint)"
    assert nothing(shelf, board_keepout) and nothing(shelf, board) and nothing(shelf, body), "battery shelf collides"
    assert not hits(shelf, bat) and hits(Pos(0, 0, -0.2) * bat, shelf), "holder doesn't sit on the shelf"
    plugs = box(gx(MB_HDR_X[0]), gx(MB_HDR_X[1]), gy(1.5), gy(6.0), mb_top, mb_top + PLUG_H)
    assert (gx(1) - gx(0)) * (gy(1) - gy(0)) > 0, "main board placed as a mirror image (component side down)"
    j_amp_w = box(gx(J_AMP[0][0]) - 1.3, gx(J_AMP[0][1]) + 1.3, gy(J_AMP[1]) - 1.3, gy(J_AMP[1]) + 1.3, mb_top, mb_top + 6.0)
    assert nothing(plugs, body) and nothing(plugs, bat) and nothing(plugs, shelf), \
        "Dupont plugs on J_KEY/J_BAT hit plastic, the shelf or the battery"
    assert nothing(j_amp_w, body) and nothing(j_amp_w, shelf), "J_AMP's soldered wires (6 mm up) hit plastic or the shelf"
    # ---- MX key row: plate on its posts, switches, wiring, caps (ux: actuates >= 0.5 before flush, 0.5 opening) ----
    n_w = lambda d, x: Pos(0, -d * math.sin(_T), d * math.cos(_T)) * x   # noqa: E731  shift along the face normal
    assy = [plate, wiring] + switches
    assert all(nothing(x, body) for x in assy), "key plate, a switch or the switch wiring hits the shell"
    up = lambda d, x: Pos(0, d * math.cos(_T), d * math.sin(_T)) * x   # noqa: E731  shift up the slope
    assert hits(n_w(0.1, plate), body), "key plate doesn't sit on its posts"
    assert hits(n_w(-0.3, plate), body), "key plate isn't held by the post heads (review S18)"
    assert all(nothing(up(d, x), body) for d in (1, 2, KEYHOLE[0]) for x in assy) \
        and all(nothing(n_w(-d, up(KEYHOLE[0], x)), body) for d in (1, 2, PLATE_TRAVEL) for x in assy), \
        "key plate + switches can't go on (over the heads, then down the keyholes)"
    assert all(nothing(c, x) for c in caps for x in [body, plate, wiring] + switches), "a key cap rubs the shell or its switch"
    gap = [on_face(u, V_BTN, 0.5, Box(KEY[0] + 2 * 0.5 - 0.04, KEY[1] + 2 * 0.5 - 0.04, WALL + 1.0, align=MIN_TOP)) for u in key_u]
    assert all(nothing(g, body) for g in gap), "cap opening < 0.5 per side (ux)"
    assert all(nothing(n_w(-KEY[2], c), x) for c in caps for x in [body] + switches), "a cap pressed flush rubs the shell or hits its switch"
    assert KEY[2] < CAP_STOP <= MX_TRAVEL and all(hits(n_w(-CAP_STOP - 0.1, c), x) for c, x in zip(caps, switches)), \
        "no hard stop just past flush (before the switch bottoms out)"
    assert KEY[2] - MX_ACT >= 0.5 - 1e-6, f"the switch fires only {KEY[2] - MX_ACT:.1f} before the cap is flush (ux: >= 0.5)"
    assert 2.8 - (MX_STEM[2] / 2 + max(STEM_TRY)) >= 0.5 - 1e-6, "cap stem tube wall < 0.5 at the cross tips"
    pins_zone = [on_face(U0 + sx * STRIP_HOLE[0], LED_V + STRIP_HOLE[2], 0, Cylinder(STRIP_HOLE[1] / 2, 200)) for sx in (-1, 1)]
    strip_path = on_face(U0, LED_V, W_STRIP, Box(STRIP[0], STRIP[1], STRIP[2] + 2.0, align=MIN_TOP)) - pins_zone
    assert all(nothing(strip_path, x) for x in [body] + assy), "LED strip can't slide onto its pins (path blocked)"
    assert all(nothing(x, y) for x in led_stubs for y in assy), "LED stubs behind the strip hit the key plate or switches"
    for name, part in {"adapter": adapter, "adapter wires": ad_wires}.items():
        assert nothing(part, body) and nothing(part, bat) and nothing(part, board_keepout) and nothing(part, strip), \
            f"{name} collides"
    for name, part in {"battery": bat, "main board keep-out": board_keepout, "glass": glass, "adapter": adapter,
                       "LED strip": strip}.items():
        assert not hits(part, body), f"{name} collides with the shell"
    assert not any(hits(c, body) for c in caps), "key cap rubs its guide (corner presses would jam)"
    assert not any(hits(s, body) for s in switches), "key switch hits the shell"
    for a, b, msg in [(board_keepout, bat, "main board hits the battery"), (adapter, strip, "adapter hits the LED strip"),
                      (adapter, board_keepout, "adapter hits the main board"), (adapter, bat, "adapter hits the battery")]:
        assert not hits(a, b), msg
    assert not hits(frame, glass), "retainer frame presses on the glass"
    assert not any(hits(frame, s) for s in switches + caps), "retainer frame hits the keys"
    assert not hits(frame, adapter_board), "adapter pads/locators hit the adapter board"
    f_hit = frame & body
    assert not f_hit.solids() or f_hit.volume < 1, "retainer frame collides with the shell"
    assert FPC_TAIL[1] >= FPC_ROOT[1] and FPC_TAIL[1] + FPC_TAIL[0] <= FPC_ROOT[1] + FPC_ROOT[0], "FPC tail outside its root"
    for t in nfc_tags:
        assert t.distance_to(bat) >= NFC_METAL_CLR, "NFC tag closer than NFC_METAL_CLR to the cells"
    for y_n, z_n in (NFC_YZ,):                       # inner wall, upper back (lead/ux): on the wall, behind the face, >= 60 up
        d_face = y_n * math.sin(_T) - (z_n - FRONT_H) * math.cos(_T)
        assert z_n - NFC[0] / 2 - 1.5 >= WALL and d_face >= NFC[0] / 2 + 1.5 + 4 and y_n + NFC[0] / 2 + 1.5 <= DEPTH - 4, \
            "glyph/tag leaves the inner wall"
        assert z_n >= 60, "phone tag < 60 above the shelf (ux: a landscape phone flat on the wall clears the 25 mm beads)"
    gap_counter = COUNTER[0] - COUNTER[1] - W
    assert gap_counter >= COUNTER[2] + 3, f"only {gap_counter:.0f} mm beside the bead counter for a phone ({COUNTER[2]:.0f} + 3)"
    for t in nfc_tags:
        for name, part in {"battery": bat, "main board": board, "board keep-out": board_keepout, "glass": glass,
                           "adapter": adapter, "LED strip": strip, "frame": frame, "shelf": shelf, "PCA9685": pca,
                           "USB plug": usb_plug, "USB socket": usb_female}.items():
            assert not hits(t, part), f"NFC tag hits the {name}"
    # speaker (option A): in its ring, clamped by the cup, clear of every part; it goes in from the open back after the
    # reader and the amp, before the main board, shelf and battery (review B14), then +x into the ring
    others = {"adapter": adapter, "adapter wires": ad_wires, "frame": frame, "glass": glass, "LED strip": strip,
              "key plate": plate, "PCA9685": pca, "RC522": rc522, "badge insert": tile, "LED5": led5, "LED5 wires": led5_wires,
              "battery": bat, "shelf": shelf, "board keep-out": board_keepout, "main board": board, "cover": cover}
    for name, part in {"shell": body, **others}.items():
        for pn, x in (("speaker", speaker), ("cup", cup_body)):
            assert nothing(x, part), f"{pn} hits the {name}"
    assert nothing(speaker, cup_body), "speaker hits the cup"
    assert hits(Pos(0.05, 0, 0) * speaker, cup_body) is False and hits(Pos(-0.05, 0, 0) * speaker, cup_body), \
        "the cup's shoulder doesn't clamp the speaker's rim"
    assert all(hits(r_, speaker) for r_ in cup_ribs), "cup crush ribs don't grip the speaker's rim"
    path = {"shell": body, **{k: v for k, v in others.items()
                              if k not in ("battery", "shelf", "board keep-out", "main board", "cover")}}
    reach = DEPTH + 10 - (SPK_YZ[0] - cup_out[0] / 2)
    for name, part in path.items():
        for x in (cup_body, speaker):          # (the ribs grip the speaker by design, checked above)
            assert all(nothing(Pos(-4, dy, 0) * x, part) for dy in (0, 15, 30, reach / 2, reach)) \
                and all(nothing(Pos(-dx, 0, 0) * x, part) for dx in (1, 2, 4)), f"speaker + cup can't go in past the {name}"
    y_face_in = (SPK_YZ[1] + ring_out[1] / 2 - FRONT_H) / math.tan(_T) + WALL / math.sin(_T)
    assert SPK_YZ[0] - ring_out[0] / 2 >= y_face_in and SPK_YZ[0] + cup_out[0] / 2 <= DEPTH - 4.5 \
        and SPK_YZ[1] - cup_out[1] / 2 >= WALL and SPK_YZ[1] + ring_out[1] / 2 <= H - WALL, "speaker unit leaves the outer wall"
    face_x = max(x.bounding_box().max.X for x in (frame, glass, strip, adapter))   # they come in from the back past the lip
    assert WALL_IN - H_RING - face_x >= 0.5, f"speaker lip stands {H_RING:.1f} proud: the frame/glass/strip pass it by < 0.5"
    back = xslab(X_SH - CUP[0], X_SH, *cav) - speaker
    assert back.volume >= 20000, f"back volume {back.volume / 1000:.1f} cm3 < 20 (electronics)"
    open_ = len(SPK_GRILLE) * math.pi * (GRILLE_HOLE[0] / 2) ** 2 / (math.pi * cone[0] * cone[1])
    assert 0.30 <= open_ <= 0.40, f"grille {open_:.0%} open over the cone (electronics: 30-40 %)"
    assert rc_loop.distance_to(speaker) >= 25, "speaker < 25 mm from the RFID loop"
    face_v = lambda y, z: y * math.cos(_T) + (z - FRONT_H) * math.sin(_T)   # noqa: E731  v of a point, projected on the face
    loop_v = (v_le - RC[5], v_le)
    spk_v = (face_v(*SPK_YZ) - SPK[1] / 2, face_v(*SPK_YZ) + SPK[1] / 2)
    assert spk_v[1] <= loop_v[0] or spk_v[0] >= loop_v[1], "speaker on the loop's axis (in front of or behind it; electronics)"
    # option B: the buzzer in its disc, in the same lip; clear of every part; >= 15 from the main board (LIS3DH)
    for name, part in {"shell": body, **others}.items():
        assert nothing(buzz_disc, part) and nothing(buzzer, part), f"buzzer disc or buzzer hits the {name}"
    assert nothing(buzzer, buzz_disc) and buzzer.distance_to(board_keepout) >= 15 and rc_loop.distance_to(buzzer) >= 25, \
        "buzzer binds in its disc, or < 15 from the main board, or < 25 from the loop"
    assert xiao.distance_to(speaker) >= 15 and all(t.distance_to(speaker) >= 20 for t in nfc_tags), \
        "speaker < 15 from the XIAO or < 20 from the NTAG"
    for name, part in {"shell": body, "PCA9685": pca, "board keep-out": board_keepout, "main board": board, "battery": bat,
                       "shelf": shelf, "cup": cup, "speaker": speaker, "buzzer": buzzer}.items():
        assert nothing(amp, part), f"amp bay (board, cap or wires) hits the {name}"
    assert hits(Pos(0, 0, -1.05) * amp, body), "amp board isn't on the floor (1 mm tape)"
    assert all(nothing(Pos(0, dy, 3) * amp, body) for dy in (0, 15, 30, DEPTH - ay0)), "amp + cap can't slide in low from the back"
    assert rc_loop.distance_to(amp) >= 30, "amp board < 30 mm from the RFID loop"
    lead = math.dist(WIRE_HOLE, ((ax0 + ax1) / 2, (ay0 + ay1) / 2, AMP_Z))
    j_amp_xyz = (gx(sum(J_AMP[0]) / 2), gy(J_AMP[1]), mb_top)
    j_amp = math.dist(j_amp_xyz, ((ax0 + ax1) / 2, ay0, AMP_Z)) * 1.3      # routed along the floor, not straight
    assert lead <= 100 and j_amp <= 150, f"speaker leads {lead:.0f} (<= 150 twisted, with slack) or J_AMP wire {j_amp:.0f} (~150) too long"
    # ---- v4: LEDs + diffuser bar, PCA9685, RFID reader on top, lit badge target ----
    for name, part in {"shell": body, "frame": frame, "glass": glass, "LED strip": strip, "key plate": plate, "diffuser": diffuser}.items():
        assert not any(hits(x, part) for x in leds), f"an LED hits the {name}"
        assert nothing(diffuser, part) or name == "diffuser", f"the diffuser bar hits the {name}"
        assert all(nothing(x, part) for x in led_stubs) or name in ("LED strip", "diffuser"), f"LED stubs behind the strip hit the {name}"
    assert not any(hits(x, c) for x in leds for c in caps + switches), "LED hits a key"
    n_w = lambda d, x: Pos(0, -d * math.sin(_T), d * math.cos(_T)) * x   # noqa: E731  shift along the face normal
    assert hits(n_w(0.3, diffuser), body), "diffuser bar can fall out through its slot (no ledges)"
    assert all(nothing(n_w(-dw, diffuser), body) for dw in (2, 6, 12, 20)), "diffuser bar can't go in from the inside"
    assert GL_B - out_bot <= DIFF_V + pocket[1] / 2 - 1.0, "retainer frame doesn't hold the bar's top edge"
    dome = W_LED + LED[2] + LED[3] - LED[2]
    assert -DIFF_LIP - DIFF[2] - dome >= MIX - 1e-6, f"LED dome {-DIFF_LIP - DIFF[2] - dome:.1f} mm from the bar (< MIX)"
    assert lb_bot <= LED_V - LED[1] / 2 and LED_V + LED[1] / 2 <= lb_top, "LEDs outside their light box"
    assert DIFF_V + pocket[1] / 2 + 1.0 <= GL_B - 0.25 + 1e-6 and KEY_TO_ACTIVE <= 13.5, "diffuser doesn't fit under the glass"
    assert all(nothing(x, part) for x in led_stubs for part in (pca, board_keepout)), "LED stubs behind the strip hit a board"
    # baffles: a ray from an LED to the next segment's centre crosses the boundary MIX/2 in front of the bar; block it
    assert BAFFLE[1] >= MIX / 2 + 1.0 and all(min(abs(u - k) for k in key_u) >= LED[1] / 2 + 1.0 for u in baffle_u), \
        "baffles too shallow to keep the neighbouring colours apart, or on an LED"
    assert all(abs(u - (a + b) / 2) < 1e-6 for u, a, b in zip(baffle_u, key_u, key_u[1:])), "baffles off the key boundaries"
    for name, part in {"shell": body, "key plate": plate, "LED strip": strip, "switch wiring": wiring, "frame": frame,
                       "glass": glass, "adapter": adapter, "main board keep-out": board_keepout, "battery": bat, "shelf": shelf}.items():
        assert nothing(pca, part), f"PCA9685 (or its wires) hits the {name}"
    assert hits(Pos(0, 0, -0.55) * pca, body), "PCA9685 doesn't stand in its slots"
    in_before = (body, frame, glass, adapter, ad_wires, strip, plate, wiring) + tuple(switches)   # it goes in AFTER the frame + adapter
    assert all(nothing(Pos(0, 0, dz) * pca, x) for dz in (6, 10) for x in in_before) and \
        all(nothing(Pos(0, dy, 10) * pca, x) for dy in (10, 30, 50) for x in in_before), \
        "PCA9685 can't come in high from the back (after the frame + adapter) and drop into its slots"
    wing_parts = {"shell": body, "battery": bat, "shelf": shelf, "PCA9685": pca, "adapter": adapter, "frame": frame,
                  "glass": glass, "window": window, "cover": cover, "cup": cup, "speaker": speaker, "amp": amp}
    for name, part in {**wing_parts, "LED5": led5, "LED5 wires": led5_wires}.items():
        assert nothing(rc522, part), f"RC522 hits the {name}"
    assert nothing(rc522, tile) and hits(n_w(0.05, rc522), tile), "badge insert not held flush by the RC522 (review S16)"
    assert hits(n_w(1.05, rc522), body), "RC522 doesn't reach its pads (1 mm tape)"
    assert all(nothing(n_w(-d, rc522), x) for d in (2, 6) for x in (body, tile)) \
        and all(nothing(Pos(0, dy, 0) * n_w(-6, rc522), x) for dy in (0, 15, 30) for x in (body, tile)), \
        "RC522 can't come in from the open back and go out onto its pads"
    for name, part, d in (("AA cells", bat, 20.0), ("adapter", adapter, 10.0), ("main board", board, 10.0), ("PCA9685", pca, 10.0),
                          ("speaker", speaker, 25.0), ("amp board", amp, 30.0), ("XIAO", xiao, 20.0), ("e-paper", glass, 5.0),
                          ("LED5", led5, LED5_CLR), ("LED5 wires", led5_wires, LED5_CLR)) \
            + tuple(("NTAG", t, NFC_LOOP[1]) for t in nfc_tags):
        got = rc_loop.distance_to(part)
        assert got >= d, f"RFID loop only {got:.1f} mm from the {name} (>= {d:.0f})"
    assert glass.bounding_box().max.X < rc_loop.bounding_box().min.X, "e-paper in front of the loop (electronics: beside it)"
    assert v_rb - (LED5_V + LED[1] / 2) >= 1.0, "LED5 not below the module (it would sit behind the loop's board)"
    for name, part in wing_parts.items():
        assert nothing(tile, part), f"badge insert hits the {name}"
        assert nothing(led5, part) and nothing(led5_wires, part), f"LED5 (or its wires) hits the {name}"
    assert nothing(led5, tile) and hits(n_w(0.3, tile), body), "badge insert: LED5 touches it, or it can come out the front"
    sub = [tile, led5, led5_wires]                       # insert with LED5 glued in: from the back, then out into its window
    assert all(nothing(n_w(-d, x), ob) for d in (1, 3, 6, 12) for x in sub for ob in (body, glass, frame, adapter)) \
        and all(nothing(Pos(0, dy, 0) * n_w(-12, x), body) for dy in (20, 45) for x in sub), "badge insert + LED5 can't go into place"
    stroke = 2 * badge_txt.area / sum(e.length for e in badge_txt.edges())   # mean stroke (underestimates on curves)
    assert stroke >= 0.8 and BADGE[2] >= 0.8, f"badge mark strokes {stroke:.2f} < 0.8 mm (ux)"
    assert KEY_PITCH - KEY[0] >= 4, "keys closer than 4 mm (ux)"
    assert FRONT_H + V_BTN * math.sin(_T) >= 20, "key centre < 20 above the shelf (ux)"
    # ---- protective window (user/ux): flush rim, bears only outside the glass outline, air WIN[1] <= 1.0, no parallax loss
    assert 0.5 <= WIN[1] <= 1.0 and WIN[4] == WIN[0], "window gap outside ux's 0.5-1.0, or the rim isn't flush"
    over_glass = on_face(U_GL, V_GLASS, 1, Box(GLASS[0] + CLR, GLASS[1] + CLR, 10, align=MIN_TOP))
    assert hits(n_w(-0.05, window), body) and nothing(n_w(-0.05, window) & over_glass, body), \
        "window doesn't rest on the face, or bears on the skin over the panel (load path to the glass)"
    assert nothing(rim, window) and nothing(rim, body) and hits(n_w(-0.05, rim), body), "rim overlaps the window, or doesn't sit on the face"
    assert nothing(window, body) and nothing(window, glass) and nothing(glass, body) and nothing(foam_p, frame) \
        and nothing(foam_p, body), "window / glass / foam collide"
    hide = WIN[1] + 0.3                                  # framing edge (the mask on the window's back) -> pixels
    a_l, a_r = (U0 - view[0] / 2) - GL_L, (GL_L + GLASS[0]) - (U0 + view[0] / 2)    # aperture edge inside the glass edge
    assert WIN_VIEW[0] == WIN_VIEW[1] and min(a_l, a_r) >= -0.7 and WIN_VIEW[1] <= ACTIVE_BOTTOM - 0.1, \
        "aperture not symmetric around the active area, or it shows > 0.7 past the glass's edge (check ACTIVE_DX)"
    assert WIN_VIEW[0] >= hide * math.tan(math.radians(65)) and WIN_VIEW[1] >= hide * math.tan(math.radians(40)), \
        "view margins hide the active area at 65 deg sideways / 40 deg vertical (ux)"
    assert WIN_V[0] - 0.25 >= DIFF_V + (pocket[1] - 1.4) / 2, "window covers the LED bar's visible slot (ux: screen only)"
    # ---- USB-C: extension's male end straight into the XIAO (>= 25), female clipped in the back cover, cable left of the shelf
    for name, part in {"shell": body, "shelf": shelf, "battery": bat, "board keep-out": board_keepout, "PCA9685": pca}.items():
        assert nothing(usb_plug, part) and nothing(usb_female, part), f"USB extension hits the {name}"
    assert nothing(usb_flange, cover) and hits(Pos(0, -0.5, 0) * usb_flange, cover) and hits(Pos(0, 0, -0.5) * usb_flange, cover), \
        "USB flange not held by its clip (lips, stop)"
    assert all(nothing(Pos(0, 0, dz) * usb_female, cover) for dz in (2, 8, 15, 30)), \
        "USB female end can't drop into its clip from above (body jams on the lips; review S20)"
    assert mb_x0 + 1.4 - WALL >= USB_PLUG[2] + 3, "no room for the extension's right-angle male end beside the left wall"
    for name, part in {"shell": body, "shelf": shelf, "battery": bat, "PCA9685": pca, "adapter": adapter, "frame": frame,
                       "NFC tag": nfc_tags[0], "cup": cup}.items():
        assert nothing(usb_cable, part), f"USB cable route hits the {name}"
    assert rc_loop.distance_to(usb_cable) >= 15, "USB cable route near the RC522 loop (electronics: coil it away)"
    # ---- the end shelf (user, lead): footprint on the flat, tape strips on the flat underside, centre of mass mid-flat
    assert DEPTH + WALL <= SHELF_FLAT - 3, f"footprint {DEPTH + WALL:.1f} deep: more than {SHELF_FLAT - 3:.0f} of the {SHELF_FLAT:.0f} flat"
    for ty in TAPE_Y:
        strip_ = box(WALL, W - WALL, ty, ty + 19, 0, 0.2)
        assert ty + 19 <= DEPTH and (strip_ & body).volume >= 0.98 * strip_.volume, f"tape strip at y {ty:.0f}: underside not flat"
    assert body.is_valid and cover.is_valid
    bb = (body + cover).bounding_box()
    assert max(bb.size.X, bb.size.Y, bb.size.Z) <= 256
    print("RFID loop to: " + ", ".join(f"{n} {rc_loop.distance_to(x):.1f}" for n, x in (
        ("NTAG", nfc_tags[0]), ("cells", bat), ("DESPI", adapter), ("speaker", speaker), ("amp", amp), ("buzzer", buzzer), ("XIAO", xiao),
        ("LED5", led5))) + " mm")
    print(f"speaker: {len(SPK_GRILLE)} x Ø{GRILLE_HOLE[0]:.0f} grille {open_:.0%} open over the cone; back volume {back.volume / 1000:.0f} cm3; "
          f"to XIAO {xiao.distance_to(speaker):.0f}, to NTAG {nfc_tags[0].distance_to(speaker):.0f}; amp to loop {rc_loop.distance_to(amp):.0f}; "
          f"leads {lead:.0f} mm, J_AMP wire ~{j_amp:.0f} mm")
    print(f"key top -> active area {KEY_TO_ACTIVE:.1f} mm; LED dome -> diffuser {-DIFF_LIP - DIFF[2] - dome:.1f} mm "
          f"(MX plate {-P_W:.1f} behind the face); front wall {FRONT_H:.1f}, key centre {FRONT_H + V_BTN * math.sin(_T):.1f} above the shelf")
    # rough centre of mass (ux: low and back): PETG 1.27 g/cm3 solid, cells + holder 84 g, glass 21 g, boards ~25 g
    items = [(body, None), (cover, None), (frame, None), (plate, None), (shelf, None), (bat, 84.0), (glass, 21.0), (board, 12.0),
             (rc522, 8.0), (pca, 6.0), (cup, None), (speaker, 20.0), (amp, 3.0)]
    ms = [(m_ or x.volume * 1.27e-3, x.center()) for x, m_ in items]
    mt = sum(m_ for m_, _ in ms)
    cy, cz = (sum(m_ * c.Y for m_, c in ms) / mt, sum(m_ * c.Z for m_, c in ms) / mt)
    print(f"mass ~{mt:.0f} g, centre of mass {cy:.0f} mm back (of {DEPTH:.0f}), {cz:.0f} mm up (of {H:.0f})")
    assert 0.3 * SHELF_FLAT <= cy <= 0.7 * SHELF_FLAT, f"centre of mass {cy:.0f} not over the middle of the {SHELF_FLAT:.0f} flat"
    print(f"window: {WIN[0]:.0f} mm PC, cut {WIN_SIZE[0]:.1f} x {WIN_SIZE[1]:.1f}, corners R{WIN[5]}; {WIN[1]} air to the glass; "
          f"clear aperture {view[0]:.1f} x {view[1]:.1f} (active + {WIN_VIEW[0]:.1f} all round); black mask from the window's edges: "
          f"left {APERTURE[0]:.1f}, right {APERTURE[1]:.1f}, top {APERTURE[2]:.1f}, bottom {APERTURE[3]:.1f}; tag {NFC_YZ[1]:.0f} up, "
          f"{gap_counter:.0f} mm to the counter")
    print(f"scoreboard {bb.size.X:.0f} x {bb.size.Y:.0f} x {bb.size.Z:.0f} mm (w x d x h), face {TILT_DEG:.0f} deg, "
          f"{KEYS} keys {KEY[0]:.0f}x{KEY[1]:.0f} at {KEY_PITCH} mm")


PARTS = {   # name: (shape, print orientation)
    "scoreboard_shell": (body, Rot(180 - TILT_DEG, 0, 0) * body),   # face down: clean window, matte on textured PEI, no supports
    "scoreboard_cover": (cover, Rot(90, 0, 0) * cover),             # outer face down
    "scoreboard_key": (key_cap, Rot(180, 0, 0) * key_cap),         # print 4; top face down
    "scoreboard_frame": (frame, Rot(180 - TILT_DEG, 0, 0) * frame), # glass side down, pads up
    "scoreboard_keyplate": (plate, Rot(180 - TILT_DEG, 0, 0) * plate),   # front face down, rail up; MX clips need its 1.5
    "scoreboard_stemtest": (stemtest, stemtest),                   # print first: 4 cap sockets, pick STEM_CLR
    "scoreboard_shelf": (shelf, shelf),                            # flat, fence up
    "scoreboard_badge": (tile, Rot(-TILT_DEG, 0, 0) * tile),       # natural/white PETG, back down, face up; iron the top
    "scoreboard_speaker_cup": (cup, Rot(0, -90, 0) * cup),         # bottom down, open end up: no overhangs
    "scoreboard_rim": (rim, Rot(180 - TILT_DEG, 0, 0) * rim),       # window rim (3 sides), flat side down; case colour
}

if __name__ == "__main__":
    self_check()
    if "--check" in sys.argv:
        sys.exit()
    OUT.mkdir(exist_ok=True)
    for name, (_, printable) in PARTS.items():
        b = printable.bounding_box()
        printable = Pos(-b.min.X, -b.min.Y, -b.min.Z) * printable
        export_stl(printable, str(OUT / f"{name}.stl"))
        m = Mesher()
        m.add_shape(printable)
        m.write(str(OUT / f"{name}.3mf"))
    shell_c, cover_c, paper_c, cap_c, part_c = "#3b4252", "#5b6478", "#e8e6df", "#d08770", "#5e81ac"
    win_c = "#cfe8f2"
    outside = [(body, shell_c, 1), (cover, cover_c, 1), (paper, paper_c, 1), (caps, cap_c, 1), (diffuser, "#f2f2f2", 1),
               (tile, "#f5f0e1", 1), (window, win_c, 0.1), (win_mask, shell_c, 1), (rim, shell_c, 1)]
    render(OUT / "scoreboard_preview.png", outside, view=(-0.35, -1, 0.55), size=(800, 600))
    render(OUT / "scoreboard_inside.png", [(body, shell_c, 0.25), (strip, part_c, 1), (leds, "#a3be8c", 1), (diffuser, "#eceff4", 1),
                                           (tile, "#f5f0e1", 1), (led5, "#a3be8c", 1), (plate, "#d8dee9", 1), (switches, "#88c0d0", 1),
                                           (caps, "#d08770", 1), (pca, "#b48ead", 1), (rc522, "#88c0d0", 1), (bat, "#ebcb8b", 1),
                                           (board, part_c, 1), (adapter, part_c, 1), (nfc_tags, "#d08770", 1), (speaker, "#4c566a", 1),
                                           (cup, "#d8dee9", 1), (amp, "#a3be8c", 1), (usb_female, "#2e3440", 1), (usb_plug, "#2e3440", 1)],
           view=(0.5, 1, 0.7), title="v5 inside: keys + LED bar, PCA9685 on edge, reader in the wing, battery over the board, speaker")
    render(OUT / "scoreboard_badge.png", outside, view=(0.45, -1, 0.45), size=(800, 600),
           title="Face: e-paper under the PC window; badge target in the right wing")
    render(OUT / "scoreboard_open.png", [(body, shell_c, 1), (Pos(0, 40, 0) * cover, cover_c, 1), (paper, paper_c, 1),
                                         (caps, cap_c, 1), (bat, "#ebcb8b", 1), (board, part_c, 1), (shelf, cover_c, 1),
                                         (strip, part_c, 1), (switches, "#88c0d0", 1), (adapter, part_c, 1), (frame, cover_c, 1),
                                         (leds, "#a3be8c", 1), (diffuser, "#eceff4", 1), (tile, "#f5f0e1", 1),
                                         (pca, "#b48ead", 1), (rc522, "#88c0d0", 1), (led5, "#a3be8c", 1), (cup, "#d8dee9", 1),
                                         (amp, "#a3be8c", 1), (Pos(0, 40, 0) * usb_female, "#2e3440", 1), (usb_plug, "#2e3440", 1)],
           view=(0.6, 1, 0.6), title="Scoreboard v5: back cover off (USB-C socket clipped in it); 3xAA, boards, key row inside")
    kc = on_face(0, V_BTN + 4, -12, Box(1, 1, 1)).center()                                                   # key row region
    half = box(key_u[1], W + 1, kc.Y - 32, kc.Y + 32, max(-1, kc.Z - 32), kc.Z + 32)   # section through key 2, seen from its left
    render(OUT / "scoreboard_keyrow.png", [(x & half, c, 1) for x, c in (
        (body, shell_c), (frame, cover_c), (plate, "#d8dee9"), (switches[1], "#88c0d0"), (stems[1], "#5e81ac"), (caps[1], cap_c),
        (strip, part_c), (leds[1], "#a3be8c"), (diffuser, "#eceff4"), (glass, paper_c), (wiring, "#bf616a"), (pca, "#b48ead"))],
           view=(-1, 0, 0), size=(1000, 800), title="Key row section: front wall, cap 3 proud, MX on its plate, LED strip, opal bar")
    wc = on_face(U0, GL_B + 6, -2, Box(1, 1, 1)).center()                                                   # window, bottom edge
    sect = box(U0, W + 1, wc.Y - 14, wc.Y + 14, wc.Z - 14, wc.Z + 14)
    render(OUT / "scoreboard_window.png", [(x & sect, c, 1) for x, c in (
        (body, shell_c), (window, win_c), (glass, paper_c), (foam_p, "#ebcb8b"), (frame, cover_c), (diffuser, "#eceff4"))
        if (x & sect).solids()],
           view=(-1, 0, 0), size=(1000, 800), title="Window section: 3 mm PC on the face, 0.9 air, panel, 0.8 foam, backing plate")
    render(OUT / "scoreboard_speaker.png", outside, view=(1, -0.35, 0.35), size=(800, 600),
           title="Right (outer) side: one grille for the speaker (A) or the buzzer disc (B)")
    cut = box(W_MAIN - 6, W + 1, -1, DEPTH + 10, -1, H + 1)
    render(OUT / "scoreboard_speaker_inside.png", [(body & cut, shell_c, 0.35), (speaker, "#4c566a", 1), (cup, "#d8dee9", 1),
                                                   (amp, "#a3be8c", 1), (rc522, "#88c0d0", 1), (tile, "#f5f0e1", 1),
                                                   (led5, "#a3be8c", 1), (led5_wires, "#bf616a", 1)],
           view=(-1, 0.15, 0.25), size=(1000, 800),
           title="Wing, inside: reader (loop up), insert + LED5 below it, speaker + cup back-low, amp on the floor")
    print("exported + rendered: out/scoreboard_*")
