"""The goal-counter sled: roll test v2's ball path (roll_test.py, imported, not copied) with the electronics inside L.

    uv run python sled.py          # self-check, then out/sled_plate1..3.3mf + STLs + renders
    uv run python sled.py --check  # self-check only

Layout agreed with electronics and lead (mechanical/reports/2026-10-17-sled-layout.md, electronics/dimensions.md
'Placement in the goal-counter sled'), with assembly-review's S21-S26 / N17-N19 folded in. In L's box, from the front:
the 70 x 30 board (USB-C straight through the front wall), the FIT0610 3xAA holder in a pocket (it lifts out for the
swap; two lid posts on foam pads hold it down), the TSAL6200 in an open-top trough at the beam. The receiver's keyed
3-pin joint sits in a bay at L's front-right corner, reachable at the mouth; R's lead reaches it over R's front bridge.
A cord loop anchored in the mouth bay's left wall pulls L out (the opening hides L's left front: e_L 10-15). The lid is recessed in the roof
plane: two tongues under the roof at the back and a spring finger in its own plane at the front-left.
Same frame as roll_test.py: s into the tunnel, y = 0 at L's left face (the channel side at -BLK), z up from the floor.
Every number is EST until measured (rule 11).
"""
import math
import sys

from build123d import Align, Cylinder, Mesher, Plane, Polygon, Pos, Rot, Text, export_stl, extrude

import roll_test as rt
from roll_test import (BEAM, BEAM_Z, BLK, FLOOR_L, RAIL, RAIL_Z, ROOF_SLOPE, ROOF_Z, S0, T, W, YCYL, box, below_roof,
                       nothing, prism, render, unbridged, yz_prism)

E_L = (10.0, 15.0)                # the opening's left edge from L's left face (user 2026-10-17: "around 1-1.5 cm"): checked at both
Z_BAR = 10.0                      # EST: the frame's bar top above the tunnel floor (user 2026-10-16: the floor is ~10 below it)
T_LID, C = 1.6, 0.2               # lid (flush with the roof plane, as in the roll test: >= 10 over the header plugs), clearance
FOAM = (3.0, 1.5)                 # foam pad on each holder post: free, squeezed (assembly-review S26)


def zr(y):                        # the roof plane's height at y (it falls toward the channel)
    return ROOF_Z + y * math.tan(ROOF_SLOPE)


def band(d0, d1):                 # the slab d0..d1 below the roof plane
    return Pos(0, 0, -d0) * below_roof - Pos(0, 0, -d1) * below_roof


def xz_prism(pts, y0, y1):        # XZ polygon (s, z) extruded along y from y0 to y1
    return Pos(0, y0, 0) * extrude(Plane.XZ * Polygon(*pts, align=None), y1 - y0, dir=(0, 1, 0))


UNDER = Pos(0, 0, -T_LID) * below_roof                 # walls the lid rests on stop here

# ---- the parts (electronics/dimensions.md) ---------------------------------------------------------------------------
BD = (70.0, 30.0, 1.6)            # perfboard
B0 = (37.5, -50.0, 12.7)          # its x = 0 / y = 0 corner (USB end, header edge) in s, y; its underside z
B_TOP = B0[2] + BD[2]
USB = (B0[0] + 1.4, B0[1] + 16.1, B_TOP + 5.7)          # receptacle face s, centre y, z
USB_CUT = (14.0, 8.5)             # front-wall cut-out (electronics: a <= 13 x 8 overmould reaches the port)
PINS = [(B0[0] + 66.5, B0[1] + y) for y in (3.5, 26.5)]   # Ø7 bosses under both holes; a pin only in the first (B15:
                                                       # 3.5 from the lipped edge, the other can't clear the roll-in)
HOLDER = (68.0, 47.0, 17.0)       # FIT0610 (Keystone 2487 is 68.5 x 48 x 18.5: the foam takes the height, not the width)
POCKET = (112.8, 181.8)           # S21: the board's back stop is its front wall (4.1 for the leads), the rear wall at 181.8
STOP = (B0[0] + BD[0] + 0.3, 109.0)
JST = (85.5, 108.5, -56.5, -66.5, 8.0)   # floor pocket for the mated JST-PH pair (18 x 7.5 x 5.5): s, y, depth
BAY = (37.2, 52.0, -55.0, -70.4, 26.0)   # mouth-joint bay: s, y, floor z
HDR = (7.62, 2.54, 2.5)           # 3-pin male header body (pin 3 pulled; S23): y, z, s
BTN = (-34.0, 35.5)               # undo button centre y, z (over the USB-C; inside the opening for e_L <= ~22)
HDR_Y = (BAY[2] + BAY[3]) / 2
BUZ = (HDR_Y, 17.0)               # buzzer centre y, z (under the bay)
CORD = ((41.0, 47.0), 33.0)       # pull cord: two Ø3 holes through the bay's left wall at these s, z
EM = (2.5, 2.9, 7.7, 1.0, 12.0)   # TSAL6200: body r, flange r, tip -> flange top, flange, tip behind the aperture
EM_TIP = -BLK + EM[4]
EM_FL = EM_TIP + EM[2]            # flange's front (top) face
LANT = (B0[0] + 18, B0[0] + 22)   # XIAO antenna, x 18-22

# ---- L: roll_test's shell with this box inside -----------------------------------------------------------------------
inner = box(STOP[0], STOP[1], -T, -T - 49.2, 0, 100) & UNDER                            # back stop = battery front wall
inner += box(POCKET[1], POCKET[1] + T, -T, -T - 49.2, 0, 100) & UNDER                   # battery rear wall
inner += box(STOP[1], POCKET[1] + T, -T - 48.0, -T - 49.2, 0, 10)                       # pocket's channel-side wall ...
inner -= box(STOP[1], POCKET[0], -T - 47.0, -T - 50.0, -1, 11)                          # ... with the leads' corner notch
for y0, y1 in ((-T, -6.0), (-20.0, -26.0)):                                             # front stubs (the leads may
    inner += box(POCKET[0] - 1.0, POCKET[0], y0, y1, 0, 8)                              # leave anywhere across)
# board: end rail (x 0.5-4), edge strips (y 0-1.5, 28.5-30), Ø7 pin bosses tied low to the back stop (N18), pins, lips, clips
inner += box(B0[0] + 0.5, B0[0] + 4, B0[1], B0[1] + BD[1], 0, B0[2])
for y0 in (0.0, BD[1] - 1.5):
    inner += box(B0[0] + 0.5, PINS[0][0] - 3.5, B0[1] + y0, B0[1] + y0 + 1.5, 0, B0[2])
for s, y in PINS:
    inner += Pos(s, y, 0) * Cylinder(3.5, B0[2], align=rt.MINB)
    inner += box(s, STOP[0], y - 2.0, y + 2.0, 0, B0[2] - 3.5)
inner += Pos(*PINS[0], 0) * Cylinder(1.4, B_TOP + 2.0, align=rt.MINB)
for s in (B0[0] + 20, B0[0] + 45):                                     # lips over the socket edge (it goes in first, tilted)
    inner += box(s - 3, s + 3, B0[1] + BD[1] + 0.3, B0[1] + BD[1] + 1.9, 0, B_TOP + 1.0)
    inner += box(s - 3, s + 3, B0[1] + BD[1] - 0.6, B0[1] + BD[1] + 0.3, B_TOP + 0.1, B_TOP + 1.0)
for s in (B0[0] + 24, B0[0] + 60):                                     # snap clips on the header edge: 15 tall arms (0.4 %
    inner += box(s - 3, s + 3, B0[1] - 0.3, B0[1] - 1.9, 0, B_TOP + 1.1)   # strain for 0.8), 0.8 hooks, 45 deg lead-ins
    inner += yz_prism([(B0[1] - 0.3, B_TOP + 0.1), (B0[1] + 0.5, B_TOP + 0.1), (B0[1] + 0.5, B_TOP + 0.3),
                       (B0[1] - 0.3, B_TOP + 1.1)], s - 3, s + 3)
# JST pocket: open top, a lead entry in each end wall
jy = (JST[2] + JST[3]) / 2
inner += box(JST[0] - T, JST[1] + T, JST[2] + T, JST[3] - T, 0, JST[4]) - box(JST[0], JST[1], JST[2], JST[3], FLOOR_L, 20) \
    - box(JST[0] - 2, JST[1] + 2, jy - 2.5, jy + 2.5, 2.0, 20)
# mouth bay: walls, a floor bridging 15.4 across, the back wall with the header slot
inner += box(BAY[0], BAY[1] + 4.0, BAY[2] + T, BAY[2], 0, 100) & UNDER
inner += box(BAY[0], BAY[1] + 4.0, BAY[3], -BLK + RAIL[0], 0, BAY[4])
inner += box(BAY[0], BAY[1], BAY[2], BAY[3], BAY[4] - T, BAY[4])
inner += box(BAY[1], BAY[1] + 4.0, BAY[2], -BLK + RAIL[0], BAY[4] - T, 100) & UNDER    # bridges 15.4: the cavity
                                                                                  # under the bay is open behind
# undo button (ux B4): a front-loaded cartridge (12 x 12 tactile + cap) in a window above the USB-C, its plate on a ring
# behind the front wall; the CMT-1209 buzzer on a cradle in the cavity under the bay, port on a grille, loaded from behind
z0 = B_TOP + 14.0                 # the ring stays above the board's keep-out, its underside at 45 deg
inner += (box(S0 + T, S0 + T + 1.2, BTN[0] + 9.2, BTN[0] - 9.2, z0, BTN[1] + 9.2)
          - box(0, 100, BTN[0] + 7.1, BTN[0] - 7.1, BTN[1] - 7.1, BTN[1] + 7.1)
          - xz_prism([(S0 + T - 0.1, z0 - 1), (S0 + T + 1.3, z0 - 1), (S0 + T + 1.3, z0 + 1.3), (S0 + T - 0.1, z0 - 0.1)],
                     BTN[0] - 9.3, BTN[0] + 9.3)) & UNDER
inner += box(S0 + T, S0 + T + 9.8, BUZ[0] - 7.4, BUZ[0] + 7.4, 0, BUZ[1] - 6.2) + \
    box(S0 + T, S0 + T + 9.8, BUZ[0] - 7.4, BUZ[0] - 6.2, 0, BUZ[1]) + box(S0 + T, S0 + T + 9.8, BUZ[0] + 6.2, BUZ[0] + 7.4, 0, BUZ[1])
# lid supports: 45 deg corbels on the left wall and the rail's face; the emitter block
z_l, z_r = zr(-T - 2) - T_LID, zr(-BLK + RAIL[0] + 2) - T_LID
inner += yz_prism([(-T, z_l - 2.3), (-T - 2, z_l - 0.3), (-T - 2, 100), (-T, 100)], S0 + T, STOP[0]) & UNDER   # not over the holder
inner += yz_prism([(-BLK + RAIL[0], z_r - 2.3), (-BLK + RAIL[0] + 2, z_r - 0.3), (-BLK + RAIL[0] + 2, 100),
                   (-BLK + RAIL[0], 100)], BAY[1] + 4, BEAM - 5) & UNDER   # clear of the tab as the lid tips out
inner += box(BEAM - 6, BEAM + 6, EM_FL + EM[3] + 2.2, -BLK, 0, 25)
# LED-lead clips on the channel side of the finger gap (N17): post + 0.8 lip, the lead lies against the wall under the rail
for s in (125.0, 150.0, 172.0):
    inner += box(s - 2.5, s + 2.5, -73.2, -74.4, 0, 8) + box(s - 2.5, s + 2.5, -74.4, -75.2, 7.2, 8)
part_l = rt.l_shell(inner)

# the lid's tab over the emitter: the roof starts at s 199 there (a new front wall), its old front wall is notched (S22)
part_l -= box(BEAM, 199, -50, -BLK + RAIL[0], 25, 100) + box(BEAM, 199, -50, EM_FL + EM[3] + 2.2, 10, 25)
part_l += box(199, 200.2, -50, -73.5, 0, 100) & below_roof
# cuts: USB-C, the pull cord's holes, the bay's front notch and header slot, the emitter trough, lid slots
part_l -= box(S0 - 1, S0 + T + 0.1, USB[1] - USB_CUT[0] / 2, USB[1] + USB_CUT[0] / 2, USB[2] - USB_CUT[1] / 2,
              USB[2] + USB_CUT[1] / 2)                                            # its top bridges 14 (L: <= 16)
for s in CORD[0]:                 # the cord goes out through one, back through the other; its knot sits in the bay
    part_l -= YCYL(s, BAY[2] - 0.5, CORD[1], 1.5, T + 2)
part_l -= box(S0 - 1, BAY[0] + 0.1, BAY[2], BAY[3], BAY[4], 100)
part_l -= box(S0 - 1, S0 + T + 0.1, BTN[0] - 7.9, BTN[0] + 7.9, BTN[1] - 7.9, BTN[1] + 7.9)        # button window (bridges 15.8)
for a in [None] + list(range(0, 360, 60)):                                                         # buzzer grille
    y, z = (BUZ[0], BUZ[1]) if a is None else (BUZ[0] + 3.2 * math.cos(math.radians(a)), BUZ[1] + 3.2 * math.sin(math.radians(a)))
    part_l -= Pos(S0 - 1, y, z) * Rot(0, 90, 0) * Cylinder(1.0, T + 2, align=rt.MINB)
ARROW = Plane(origin=(S0, -48.6, 35.5), x_dir=(0, -1, 0), z_dir=(-1, 0, 0))   # embossed undo arrow, 0.6 proud (ux)
part_l += ARROW.location * extrude(Text("\u21b6", font_size=13, font_path=str(rt.FONT), align=(Align.CENTER, Align.MIN)), 0.6)
part_l -= box(BAY[1] + 0.8, BAY[1] + 3.3, HDR_Y - 3.9, HDR_Y + 3.9, BAY[4], 100)          # body cavity
part_l -= box(BAY[1] - 0.1, BAY[1] + 4.1, HDR_Y - 3.3, HDR_Y + 3.3, BAY[4], 100)          # pin / tail slits
part_l -= YCYL(BEAM, -BLK - 1, BEAM_Z, 1.5, EM[4] + 1)                                    # Ø3 aperture tube
for y0, y1, r in ((EM_TIP, EM_FL, EM[0] + 0.15), (EM_FL, EM_FL + EM[3] + 0.4, EM[1] + 0.25),
                  (EM_FL + EM[3] + 0.4, EM_FL + EM[3] + 2.3, EM[0] + 0.15)):            # trough: body, flange slot, legs
    part_l -= YCYL(BEAM, y0, BEAM_Z, r, y1 - y0) + box(BEAM - r, BEAM + r, y0, y1, BEAM_Z, 100)
# the lid's catches: windows in the roof's front walls (rear lips) and in the front wall (the spring tab's lip)
HOOKS = [(BEAM, -8.0, -22.0), (BEAM, -30.0, -44.0)]   # wall face s, y range (one row: the lid tilts about it)
for s, y0, y1 in HOOKS:
    part_l -= box(s - 0.1, s + T + 0.1, y0 + 0.3, y1 - 0.3, 0, 100) & band(T_LID + 1.6, T_LID + 3.2)
TAB = (-44.0, -52.0, 8.6, 0.3)    # front spring tab (between the undo button and the bay): y range, catch depth under the lid, interference (0.5 % strain)
zc = zr(sum(TAB[:2]) / 2) - T_LID - TAB[2]
part_l -= box(S0 - 1, S0 + T + 0.1, TAB[0] + 0.5, TAB[1] - 0.5, zc - 1.6, zc + 0.2)

# ---- the lid --------------------------------------------------------------------------------------------------------
lid = box(S0 + T + C, BEAM - C, -BLK + RAIL[0] + 0.6, -T - C, 0, 100) + box(BEAM - 1, 199 - C, -50 - C, -BLK + RAIL[0] + 0.6, 0, 100)
# (0.6 at the rail: tipped about its lips' sloped line, the lid's right edge moves 0.3 toward the rail)
lid = lid & band(0, T_LID)
lid -= box(S0, BAY[1], BAY[2], -BLK, -1, 100)                                    # the bay stays open on top
lid -= box(88, 102, -32, -18, 0, 100)                                            # calibration sockets
lid -= box(BEAM - C - 0.5, BEAM, -1, -80, 0, 100) & band(0, 0.5)                  # 0.5 rebate on the top rear edge (N20)
for s, y0, y1 in HOOKS:             # rear: tabs 3 below the lid, 0.9 lips into the walls' windows (they go in first)
    lid += box(s - C - T, s - C, y0, y1, 0, 100) & band(T_LID - 0.01, T_LID + 3.0)
    lid += box(s - C, s + 0.7, y0, y1, 0, 100) & band(T_LID + 1.8, T_LID + 3.0)
# front: a 1.2 spring tab hanging ~10 behind the front wall; its 0.8 lip (45 deg lead-in) clicks into the wall's window
t0 = S0 + T + 0.8 - TAB[3]        # the tab's front face: its 0.8 lip reaches TAB[3] into the front wall
lid += box(t0, t0 + 1.2, *TAB[:2], zc - 1.4, 100) & Pos(0, 0, -T_LID + 0.01) * below_roof
lid += xz_prism([(t0, zc), (t0 - 0.8, zc), (t0 - 0.8, zc - 0.6), (t0, zc - 1.4)], TAB[1], TAB[0])
POSTS = [(130.0, -24.6), (165.0, -24.6)]
H_TOP_HOLDER = FLOOR_L + HOLDER[2]
for s, y in POSTS:                # 1.5 short of the holder's cover; a 3 mm foam pad on each squeezes to 1.5 (S26)
    lid += Pos(s, y, H_TOP_HOLDER + FOAM[1]) * Cylinder(4.0, 40, align=rt.MINB) & below_roof

# ---- the undo button's cartridge and cap (separate prints; the cap in a contrasting filament, ux) ----------------------
CAP = (37.0, 38.4, 39.6)          # cap front (1 behind L's face), flange front (the plate's back face), back (on the actuator)
btn_cart = box(S0, S0 + T, BTN[0] - 7.7, BTN[0] + 7.7, BTN[1] - 7.7, BTN[1] + 7.7) + \
    box(S0 + T, CAP[2] + 3.8 + 3.5 + 0.9, BTN[0] - 7.0, BTN[0] + 7.0, BTN[1] - 7.0, BTN[1] + 7.0)
ribs = box(S0 + T + 0.5, S0 + T + 6, BTN[0] - 0.4, BTN[0] + 0.4, BTN[1] - 7.15 - 0.15, BTN[1] - 7.0) + \
    box(S0 + T + 0.5, S0 + T + 6, BTN[0] - 0.4, BTN[0] + 0.4, BTN[1] + 7.0, BTN[1] + 7.15 + 0.15)   # crush ribs: 0.1 press fit
XB = lambda s0, s1, r: Pos(s0, BTN[0], BTN[1]) * Rot(0, 90, 0) * Cylinder(r, s1 - s0, align=rt.MINB)   # noqa: E731
btn_cart -= XB(S0 - 1, S0 + T + 0.01, 5.2) + XB(S0 + T, CAP[2] + 3.8, 6.7) + \
    box(CAP[2] + 3.8, 100, BTN[0] - 6.1, BTN[0] + 6.1, BTN[1] - 6.1, BTN[1] + 6.1)      # bore, flange chamber, switch pocket
btn_core, btn_cart = btn_cart, btn_cart + ribs
cap = XB(CAP[0], CAP[2], 5.0) + XB(CAP[1] - T, CAP[2], 6.5)
switch = box(CAP[2] + 3.8, CAP[2] + 3.8 + 3.5, BTN[0] - 6.0, BTN[0] + 6.0, BTN[1] - 6.0, BTN[1] + 6.0) + XB(CAP[2], CAP[2] + 3.8, 1.75)
cord = box(S0 - 12, CORD[0][1] + 1.0, BAY[2] - 3.0, BAY[2] - 1.0, CORD[1] - 1.0, CORD[1] + 1.0)   # render only: the loop
buzzer = Pos(S0 + T, *BUZ) * Rot(0, 90, 0) * Cylinder(6.0, 9.0, align=rt.MINB)

# ---- R: the roll test's keeper + a 3.4 x 2 rebate across its front bridge for the receiver pair (S25) -----------------
RB = (rt.S_PEGS[0] - rt.BRIDGE_H[0], 3.4, 2.0)
part_r = rt.part_r - box(RB[0] - 1, RB[0] + RB[1], -BLK + RAIL[0] + 1, -W + 2.0, rt.H_TOP - RB[2], rt.H_TOP + 1)
pair_bridge = box(RB[0] + 0.1, RB[0] + 3.3, -BLK + RAIL[0], -W + 2.4, rt.H_TOP - 1.8, rt.H_TOP - 0.2)   # 2 x Ø1.6, under the top
pair_climb = box(RB[0] - 1.8, RB[0] - 0.1, *rt.W_Y, rt.Z_LD + 0.1, rt.H_TOP - 0.3)   # free, up the bridge's face
cart = rt.cart

# ---- dummies: the electronics (checks + renders) --------------------------------------------------------------------
board = box(B0[0], B0[0] + BD[0], B0[1], B0[1] + BD[1], B0[2], B_TOP)
for s, y in PINS:
    board -= Pos(s, y, 0) * Cylinder(1.6, 100, align=rt.MINB)
xiao = box(USB[0], USB[0] + 21, USB[1] - 8.9, USB[1] + 8.9, B_TOP + 2.5, B_TOP + 4.1) + \
    box(USB[0], USB[0] + 7.5, USB[1] - 4.5, USB[1] + 4.5, USB[2] - 1.6, USB[2] + 1.6)
tall = box(B0[0] + 52, B0[0] + 64, B0[1] + 22, B0[1] + 28, B_TOP, B_TOP + 14)      # sockets + 470 µF (14 keep-out)
plugs = box(B0[0] + 33, B0[0] + 52, B0[1] + 2.0, B0[1] + 4.8, B_TOP, 31.0)          # J_PT / J_LED / J_BAT Dupont plugs
holder = box(POCKET[0] + 0.5, POCKET[1] - 0.5, -T - 0.5, -T - 0.5 - HOLDER[1], FLOOR_L, H_TOP_HOLDER)
foam = Pos(*POSTS[0], H_TOP_HOLDER) * Cylinder(4.0, FOAM[1], align=rt.MINB) + \
    Pos(*POSTS[1], H_TOP_HOLDER) * Cylinder(4.0, FOAM[1], align=rt.MINB)
jst = box(97.0 - 11, 97.0 + 11, -61.5 - 4.5, -61.5 + 4.5, FLOOR_L, FLOOR_L + 7)   # electronics' >= 22 x 9 x 7 for the mated pair
emitter = YCYL(BEAM, EM_TIP, BEAM_Z, EM[0], EM[2]) + YCYL(BEAM, EM_FL, BEAM_Z, EM[1], EM[3])
em_legs = box(BEAM - 0.25, BEAM + 0.25, EM_FL + EM[3], EM_FL + EM[3] + 3.0, BEAM_Z - 1.6, BEAM_Z + 1.6) + \
    box(BEAM - 14, BEAM + 0.25, EM_FL + EM[3] + 2.5, EM_FL + EM[3] + 3.0, BEAM_Z - 1.6, BEAM_Z + 1.6)   # S22: bent toward -s
hdr = box(BAY[1] + 0.8 + 0.05, BAY[1] + 0.8 + HDR[2], HDR_Y - HDR[0] / 2, HDR_Y + HDR[0] / 2, BAY[4], BAY[4] + HDR[1]) + \
    box(BAY[1] - 5.2, BAY[1] + 6.3, HDR_Y - 2.86, HDR_Y + 2.86, BAY[4] + HDR[1] / 2 - 0.32, BAY[4] + HDR[1] / 2 + 0.32)
housing = box(BAY[0] + 0.6, BAY[1] - 0.05, HDR_Y - 3.9, HDR_Y + 3.9, BAY[4] + 0.05, BAY[4] + 2.6)    # R's 3-pin female
antenna = box(*LANT, USB[1] - 8.9, USB[1] + 8.9, B_TOP + 2.5, B_TOP + 4.1)
electronics = board + xiao + tall + plugs + holder + foam + jst + emitter + em_legs + hdr + housing + switch + buzzer
lis3dh = box(B0[0] + 26, B0[0] + 49, B0[1], B0[1] + BD[1], B_TOP, B_TOP + 3)      # electronics: x 26-49, anywhere across

PRINT = {"sled_R": Rot(90, 0, 0) * part_r, "sled_L": part_l, "sled_lid": Rot(180, 0, 0) * Rot(-math.degrees(ROOF_SLOPE), 0, 0) * lid,
         "sled_button": Rot(0, -90, 0) * btn_cart, "sled_cap": Rot(0, 90, 0) * cap}
rt.PRINT.update(PRINT)
rt.SLIDING.update({"sled_R": rt.SLIDING["R"], "sled_L": rt.SLIDING["L"]})
PLATES = {"sled_plate1": [("sled_R", 90, 3.0, 3.3), ("cartridge", 0, 226, 206)],
          "sled_plate2": [("sled_L", 12, 10.8, 116.6)],
          "sled_plate3": [("sled_lid", 0, 40, 80), ("sled_button", 0, 40, 170), ("sled_cap", 0, 76, 170)]}
rt.PLATES.update(PLATES)
rt.PLATE_RULES.update({"sled_plate1": rt.PLATE_RULES["roll_test_plate1"]})


def in_opening(r, z, m):          # (r from L's left face, z) inside the R10-cornered opening, m clear of its edges, at
    return all(_in_opening(r, z, m, e) for e in E_L)   # both ends of e_L's range


def _in_opening(r, z, m, e):
    o0, o1, z0, z1, rc = e + m, e + rt.OPEN[0] - m, Z_BAR + m, Z_BAR + rt.OPEN[1] - m, rt.OPEN[2] - m
    if not (o0 <= r <= o1 and z0 <= z <= z1):
        return False
    cr, cz = min(max(r, o0 + rc), o1 - rc), min(max(z, z0 + rc), z1 - rc)
    return math.hypot(r - cr, z - cz) <= rc + 1e-9


def self_check():
    n_q, _ = rt.shared_checks(part_l, part_r, cart, lid)   # queue, opening, envelope, roof, rail joint, ball path
    # supports off: everything <= 45 deg or a bridge (R, the cartridge: <= 10; L: <= 16, past its 60 deg lip; the lid)
    assert not unbridged(PRINT["sled_R"], 10.2) and not unbridged(PRINT["sled_L"], 16.0, 60.5) and \
        not unbridged(PRINT["sled_lid"], 10.2) and not unbridged(PRINT["sled_button"], 10.2) and \
        not unbridged(PRINT["sled_cap"], 10.2), "an overhang past 45 deg that isn't an anchored bridge, as it prints"
    # the board: its pins, stops, lips and clips hold it; supports only in the keep-out zones; 14 clear above
    assert nothing(board, part_l) and all(not nothing(Pos(*d) * board, part_l) for d in
                                           ((0.5, 0, 0), (-0.5, 0, 0), (0, 0.5, 0), (0, -0.5, 0), (0, 0, 0.4), (0, 0, -0.1))), \
        "the board isn't located (pins, front wall, back stop, pads, lips / clips over it)"
    assert not nothing(Pos(*PINS[0], B0[2]) * Cylinder(1.5, BD[2], align=rt.MINB), part_l) and \
        nothing(Pos(*PINS[1], B0[2]) * Cylinder(1.6, 10, align=rt.MINB), part_l), \
        "no locating pin through the header-edge hole, or a pin by the lipped edge (it can't roll in under the lips)"
    zones = box(B0[0] + 0.5, B0[0] + 4, B0[1], B0[1] + BD[1], 0, 20)
    for y in (0.0, BD[1] - 1.5):
        zones += box(B0[0], B0[0] + BD[0], B0[1] + y, B0[1] + y + 1.5, 0, 20)
    for s, y in PINS:
        zones += Pos(s, y, 0) * Cylinder(3.5, 20, align=rt.MINB)
    under = box(B0[0], B0[0] + BD[0], B0[1], B0[1] + BD[1], B0[2] - 3.5, B0[2])
    assert nothing((part_l & under) - zones, under), "something under the board outside its keep-out zones (B4)"
    above = box(B0[0] + 0.1, B0[0] + BD[0], B0[1] + 1.0, B0[1] + BD[1] - 1.0, B_TOP, B_TOP + 14)
    for s, y in PINS:                # the locating pins stand 2 through their holes
        above -= Pos(s, y, 0) * Cylinder(1.6, 100, align=rt.MINB)
    assert nothing(above, part_l + lid), "something in the board's 14 mm keep-out"
    assert nothing(box(B0[0] + 33, B0[0] + 52, B0[1], B0[1] + 7, B_TOP, 41.0), lid) and \
        nothing(box(B0[0] + 33, B0[0] + 52, B0[1], B0[1] + 7, B_TOP, 43.0), part_l), \
        "< 10 between the header plugs (z 31) and the lid, or < 12 for fingers with it off"
    # USB-C: straight through the front wall; inside the opening (e_L EST) and >= 10 above the bar
    over = box(S0 - 15, USB[0], USB[1] - 6.5, USB[1] + 6.5, USB[2] - 4.0, USB[2] + 4.0)   # 13 x 8 overmould
    corners = [(-USB[1] + a * USB_CUT[0] / 2, USB[2] + b * USB_CUT[1] / 2) for a in (-1, 1) for b in (-1, 1)]
    assert nothing(over, part_l + electronics - xiao) and all(in_opening(r, z, 3.0) for r, z in corners) and \
        USB[2] - Z_BAR >= 10 - 1e-6, f"USB-C: the plug can't reach it, or it's not >= 3 inside the opening (e_L {E_L})"
    holder_metal = holder.distance_to(antenna)
    assert holder_metal >= 10 and hdr.distance_to(antenna) >= 10, "metal (cells, header pins) < 10 from the antenna"
    # the holder: boxed in its pocket, lifts straight out (lid off), the posts press it through the foam
    assert nothing(holder, part_l) and all(not nothing(Pos(*d) * holder, part_l) for d in
                                            ((0.6, 0, 0), (-0.6, 0, 0), (0, 0.6, 0), (0, -0.6, 0))), "the holder isn't boxed in"
    assert nothing(box(POCKET[0] + 0.5, POCKET[1] - 0.5, -T - 0.5, -T - 47.5, FLOOR_L, 60), part_l), "the holder can't lift out"
    assert nothing(holder + foam, lid) and not nothing(Pos(0, 0, FOAM[1] + 0.2) * holder, lid), \
        "the lid posts don't stop 1.5 over the holder (3 mm foam squeezed to 1.5)"
    assert POCKET[0] - STOP[1] >= 3.5, "no room for the holder's leads at its front end (S21)"
    assert nothing(jst, part_l), "the JST pair doesn't fit its pocket"
    # emitter: drops into its trough, the flange slot holds it along the beam, the Ø3 tube is clear, coaxial with R's
    assert all(nothing(Pos(0, 0, dz) * (emitter + em_legs), part_l) for dz in (0, 3, 8, 15, 30)) and \
        all(not nothing(Pos(0, d, 0) * emitter, part_l) for d in (0.6, -0.6)), "the emitter doesn't drop in / sit in its slot"
    assert nothing(YCYL(BEAM, -BLK - 1, BEAM_Z, 1.3, EM[4] + 1), part_l) and abs(EM_TIP + BLK - 12.0) < 1e-6, \
        "the emitter's tip isn't 12 behind a clear Ø3 aperture"
    # mouth joint: header in its slot (row z 27-28), the plug and the bay open from the front and above, by the mouth
    assert nothing(hdr, part_l) and not nothing(Pos(-0.6, 0, 0) * hdr, part_l) and not nothing(Pos(0.6, 0, 0) * hdr, part_l) \
        and 27.0 <= BAY[4] + HDR[1] / 2 <= 28.0, "the header isn't held in the bay's slot (pins at z 27-28)"
    assert nothing(housing, part_l + lid) and \
        nothing(box(S0 - 5, BAY[1] - 0.1, BAY[2] - 0.1, BAY[3] + 0.1, BAY[4] + 0.1, 60), part_l + lid) and \
        all(in_opening(-y, BAY[4] + 3, 3.0) for y in (BAY[2], BAY[3])), "the mouth joint isn't reachable at the mouth"
    # undo button (ux B4): the cartridge loads from the front onto its ring, the cap sits 1 behind L's face, inside the
    # opening; the buzzer slides onto its cradle from behind, port on the grille, clear of the LIS3DH and the antenna
    assert nothing(btn_core, part_l) and not nothing(Pos(0.3, 0, 0) * btn_core, part_l) and \
        not nothing(ribs, part_l) and all(nothing(Pos(-d, 0, 0) * (btn_core + cap + switch), part_l) for d in (2, 6, 14)) and \
        nothing(cap, btn_cart) and nothing(switch, btn_cart) and nothing(cap, switch) and abs(CAP[0] - S0 - 1.0) < 1e-6, \
        "the undo button's cartridge doesn't load from the front onto its ring, or its cap isn't 1 behind the face"
    assert all(in_opening(-BTN[0] + a * 5, BTN[1] + b * 5, 3.0) for a in (-1, 1) for b in (-1, 1)), \
        f"the undo button isn't >= 3 inside the opening (e_L {E_L}: move it toward +y)"
    assert nothing(buzzer, part_l) and all(nothing(Pos(d, 0, 0) * buzzer, part_l) for d in (4, 10, 20)) and \
        not nothing(Pos(0, 0, -0.3) * buzzer, part_l) and \
        nothing(Pos(S0 - 1, *BUZ) * Rot(0, 90, 0) * Cylinder(0.9, T + 2, align=rt.MINB), part_l), \
        "the buzzer doesn't slide onto its cradle from behind, or its port isn't on the grille"
    assert buzzer.distance_to(lis3dh) >= 15 and buzzer.distance_to(antenna) >= 10 and switch.distance_to(antenna) >= 10, \
        "the buzzer is < 15 from the LIS3DH / < 10 from the antenna, or the switch < 10 from the antenna"
    assert not nothing(box(S0 - 0.6, S0, -44.0, -53.0, 36.0, 41.0), part_l), "no embossed undo arrow beside the button"
    # pull: a cord loop through two holes in the bay's left wall (L's structure, not the lid), out of the bay's front,
    # inside the opening; its pass behind the wall is clear; the grille is inside the opening too
    assert all(nothing(YCYL(s, BAY[2] - 1, CORD[1], 1.3, T + 2), part_l) for s in CORD[0]) and \
        not nothing(box(CORD[0][0] + 1.6, CORD[0][1] - 1.6, BAY[2] + T, BAY[2], CORD[1] - 1, CORD[1] + 1), part_l) and \
        nothing(box(CORD[0][0] - 1.5, CORD[0][1] + 1.5, B0[1] - 0.3, BAY[2] + T, CORD[1] - 2, CORD[1] + 2), part_l + electronics) \
        and CORD[1] > BAY[4] + 3 and all(in_opening(-y, CORD[1], 3.0) for y in (BAY[2], BAY[3])) and \
        all(in_opening(-BUZ[0] + a * 3.2, BUZ[1] + b * 3.2 + c, 2.0) for a in (-1, 1) for b in (-1, 1) for c in (0,)), \
        "the pull cord's holes / web / pass aren't there, or it or the grille isn't inside the opening"
    # the lid: covers the box, sits on its walls / corbels, can't lift (tongues under the roof + the finger), comes off
    # tilted about its tongues; prints flat on its outer face
    assert nothing(lid, part_l) and nothing(lid, part_r) and not nothing(Pos(0, 0, -0.3) * lid, part_l), \
        "the lid hits L / R, or doesn't sit on its supports"
    front = box(S0, S0 + 4, *TAB[:2], 0, 100) & lid
    rear = box(BEAM - 2, 205, -1, -80, 0, zr(-40) - T_LID) & lid
    assert not nothing(Pos(0, 0, 0.5) * front, part_l) and not nothing(Pos(0, 0, 0.5) * rear, part_l), \
        "the lid isn't held: its front tab or rear lips don't catch when L tilts over the bar"
    hy = sum(HOOKS[0][1:] + HOOKS[1][1:]) / 4    # front up 2 deg about the lips' tops (a line in the roof's slope)
    pv, sl = (BEAM, hy, zr(hy) - T_LID - 1.8), math.degrees(ROOF_SLOPE)
    tilt = Pos(*pv) * Rot(sl, 0, 0) * Rot(0, 2, 0) * Rot(-sl, 0, 0) * Pos(-pv[0], -pv[1], -pv[2])
    assert all(nothing(m * (lid - front), part_l + electronics) for m in
               (tilt, Pos(-0.75, 0, 0) * tilt, Pos(-1.5, 0, 0) * tilt, Pos(-1.5, 0, 10) * tilt)) and \
        (BEAM - S0) * math.sin(math.radians(2)) > 5, \
        "the lid can't come off: tab released, front up 2 deg (5 at the front), forward out of the lips, up"
    lb = PRINT["sled_lid"]
    first = lb & Pos(0, 0, lb.bounding_box().min.Z) * box(-1e3, 1e3, -1e3, 1e3, 0, 0.3)
    assert first.volume >= 0.3 * 8000, "the lid doesn't lie flat on its outer face for printing"
    # R's receiver pair: lies in the bridge's rebate, climbs clear of a 36 ball, ends at the bay
    ball = Pos(RB[0] - 1, -W + rt.SKIN + 18 + 0.3, 18) * rt.Sphere(18)
    assert nothing(pair_bridge, part_r) and nothing(pair_climb, part_r) and ball.distance_to(pair_climb) >= 2 and \
        nothing(pair_bridge + pair_climb, part_l), "R's receiver pair doesn't fit the bridge's rebate / climb clear of the balls"
    for plate in PLATES:
        rt.check_plate(plate)
    for name, deg in {(n, d) for pl in PLATES.values() for n, d, *_ in pl if n in rt.SLIDING}:
        assert rt.back_seams(name, deg) == 0, f"{name} turned {deg} deg: seam 'Back' lands on a groove / tongue face"
    fl = part_l & box(-1e3, 1e3, -1e3, 1e3, 0, 0.2)
    assert fl.area / 2 >= 0.6 * ((rt.S_END - S0) * BLK) * 0.5, "L: first layer is thin rails only (it lifts)"
    assert part_l.is_valid and part_r.is_valid and lid.is_valid
    vol = (part_l.volume + part_r.volume + cart.volume + lid.volume) / 1000
    print(f"sled: L {part_l.bounding_box().size.X:.0f} x {BLK:.0f} x {part_l.bounding_box().size.Z:.0f}, R as roll test v2 "
          f"+ the bridge rebate; {n_q} balls queue clear of the beam at s {BEAM:.0f}; USB-C at z {USB[2]:.0f} "
          f"({USB[2] - Z_BAR:.0f} over the bar), all front features inside the opening at e_L "
          f"{E_L[0]:.0f}-{E_L[1]:.0f}; antenna {holder_metal:.0f} from the cells; "
          f"~{vol * 1.27:.0f} g PETG solid ({vol:.0f} cm3)")


if __name__ == "__main__":
    self_check()
    if "--check" in sys.argv:
        sys.exit()
    rt.OUT.mkdir(exist_ok=True)
    out = rt.OUT
    COL = {"sled_R": "#5e81ac", "cartridge": "#3b4252", "sled_L": "#88c0d0", "sled_lid": "#a3c9d6", "sled_button": "#4c566a",
           "sled_cap": "#d08770"}
    bed = box(0, rt.BED, 0, rt.BED, -0.6, -0.3)
    for plate in PLATES:
        placed = rt.check_plate(plate)
        m = Mesher()
        for _, p in placed:
            m.add_shape(p)
        m.write(str(out / f"{plate}.3mf"))
        render(out / f"{plate}.png", [(bed, "#c8c8c8", 1)] + [(p, COL[n], 1) for n, p in placed], view=(0, 0, 1), up=(0, 1, 0),
               size=(900, 900), title=f"{plate}: 256 x 256 bed, supports off")
    for name, p in (("sled_l", part_l), ("sled_r", part_r), ("sled_lid", lid), ("sled_button", btn_cart), ("sled_cap", cap),
                    ("sled_cartridge", cart)):
        export_stl(p, str(out / f"{name}.stl"))
    parts = [(board, "#2e7d32", 1), (xiao + tall, "#37474f", 1), (plugs, "#222222", 1), (holder, "#424242", 1),
             (foam, "#f2c14e", 1), (jst, "#eeeeee", 1), (emitter + em_legs, "#bf616a", 1), (hdr + housing, "#ebcb8b", 1),
             (switch, "#222222", 1), (cap, "#d08770", 1), (btn_cart, "#4c566a", 1), (buzzer, "#111111", 1), (cord, "#bf616a", 1)]
    view = (-0.55, 0.45, 0.8)
    render(out / "sled_l_open.png", [(part_l, "#88c0d0", 1)] + parts, view=view, size=(1400, 900),
           title="L, lid off: board + USB-C, FIT0610, emitter at the beam, JST, mouth bay + pull cord, undo button")
    render(out / "sled_l_closed.png", [(part_l, "#88c0d0", 1), (lid, "#a3c9d6", 1)] + parts, view=view, size=(1400, 900),
           title="L with its lid: lips at the back, a spring tab at the front; bay open, socket hole")
    render(out / "sled_l_top.png", [(part_l, "#88c0d0", 1)] + parts, view=(0, 0, 1), up=(0, 1, 0), size=(1500, 650),
           title="L from above, lid off (front left): board, JST, holder, emitter; bay + button at the front")
    front = [(part_l, "#88c0d0", 1), (lid, "#a3c9d6", 1), (part_r, "#5e81ac", 1), (cap, "#d08770", 1), (btn_cart, "#4c566a", 1),
             (housing, "#ebcb8b", 1), (cord, "#bf616a", 1)]
    o0, o1, z0, z1, rc = -E_L[1], -E_L[1] - rt.OPEN[0], Z_BAR, Z_BAR + rt.OPEN[1], rt.OPEN[2]
    pts = []
    for cy, cz, a0 in ((o0 - rc, z0 + rc, 90), (o1 + rc, z0 + rc, 180), (o1 + rc, z1 - rc, 270), (o0 - rc, z1 - rc, 0)):
        pts += [(S0 - 2, cy + rc * math.cos(math.radians(a0 + k * 15)) * (1 if a0 in (0, 90) else 1),
                 cz + rc * math.sin(math.radians(a0 + k * 15)) * (-1 if a0 in (90, 180) else 1)) for k in range(7)]
    rect = [(S0 - 2, o0, z0 + rc), (S0 - 2, o0, z1 - rc), (S0 - 2, o1, z1 - rc), (S0 - 2, o1, z0 + rc)]
    lines = [(rect[0], rect[1]), (rect[2], rect[3]), ((S0 - 2, o0 - rc, z0), (S0 - 2, o1 + rc, z0)),
             ((S0 - 2, o0 - rc, z1), (S0 - 2, o1 + rc, z1))]
    render(out / "sled_front.png", front, view=(-1, 0, 0), up=(0, 0, 1), size=(1300, 700), lines=lines,
           title=f"Front face, opening at e_L {E_L[1]:.0f} (worst): undo button + arrow, USB-C, lid snap, bay + pull cord, grille")
    up_ = lambda dz, p: Pos(0, 0, dz) * p   # noqa: E731
    ex = [(part_l, "#88c0d0", 1), (up_(95, lid), "#a3c9d6", 1), (up_(45, holder), "#424242", 1), (up_(70, foam), "#f2c14e", 1),
          (up_(30, board + xiao + tall), "#2e7d32", 1), (up_(30, plugs), "#222222", 1), (up_(35, emitter + em_legs), "#bf616a", 1),
          (up_(20, jst), "#eeeeee", 1), (up_(40, hdr), "#ebcb8b", 1), (Pos(-40, 0, 0) * (btn_cart + switch), "#4c566a", 1),
          (Pos(-30, 0, 0) * cap, "#d08770", 1), (Pos(30, 0, -0) * Pos(0, 0, 0) * buzzer, "#111111", 1),
          (Pos(0, -60, 0) * part_r, "#5e81ac", 1), (Pos(0, -95, 0) * cart, "#3b4252", 1)]
    render(out / "sled_exploded.png", ex, view=(-0.6, 0.55, 0.65), size=(1500, 1000),
           title="Sled exploded: L's parts lift out, the button loads from the front; R + its cartridge (right)")
    render(out / "sled_l_print.png", [(PRINT["sled_L"], "#88c0d0", 1)], view=(-0.6, 0.5, 0.7), size=(1300, 850),
           title="L as it prints (upright, supports off): every overhang <= 45 deg or an anchored bridge (<= 16)")
    render(out / "sled_lid_print.png", [(PRINT["sled_lid"], "#a3c9d6", 1)], view=(-0.5, -0.6, 0.8), size=(1200, 800),
           title="Lid as it prints: outer face down; holder posts, rear lips and front tab up")
    tunnel = box(0, rt.TUNNEL[2], -W, rt.GAP, -3, 0) + box(0, rt.TUNNEL[2], rt.GAP, rt.GAP + 3, -3, rt.TUNNEL[1]) + \
        box(0, rt.TUNNEL[2], -W - 3, -W, -3, rt.TUNNEL[1])
    render(out / "sled.png", [(tunnel, "#e8dcc8", 0.35), (part_l + lid, "#88c0d0", 1), (part_r + cart, "#5e81ac", 1)],
           view=(-0.35, 0.55, 0.75), title="The goal-counter sled in the tunnel: L (light) with its lid, R (dark)")
    print("exported: out/sled_plate1-3.3mf, out/sled_*.stl, renders out/sled*.png")
