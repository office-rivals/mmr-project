"""The goal-counter sled: roll test v2's ball path (roll_test.py, imported, not copied) with the electronics inside L.

    uv run python sled.py          # self-check, then out/sled_plate1..4.3mf + STLs + renders
    uv run python sled.py --check  # self-check only

Front, take 2 (DECISIONS 2026-10-17: swap the AA cells with the sled in place; a white 0.96" OLED on the front), agreed
in mechanical/reports/2026-10-17-drawer-oled-proposal.md with electronics, ux and assembly-review (S28-S32, N21):
- L's box gets a flat top at TOP (52, the opening's limit) from the front wall to s 199; the sloped roof stays behind.
- Bottom row: a BATTERY DRAWER (printed tray + FIT0610) in a lane r 18.6-69.6, z 11.7-31, sliding out through the
  frame; a detent latch, a keyed chamfer; its battery lead rolls in a U-loop channel beside the lane, a cord stops it.
- Top row: the DASH, a separate print over the lane: the undo button (left), the OLED tilted 55 deg back (mid-opening),
  the receiver bay (right); the buzzer under the OLED's room, port up into it.
- The board sits behind the lane; its USB-C is reached through the empty lane (drawer out), with a lead-in funnel.
- The lid is flat: lips into the s 199 wall's windows, a spring tab into the dash's back wall.
Same frame as roll_test.py: s into the tunnel, y = 0 at L's left face (the channel side at -BLK), z up from the floor.
Every number is EST until measured (rule 11).
"""
import math
import sys

from build123d import Cylinder, Mesher, Plane, Polygon, Pos, Rectangle, Rot, Solid, Sphere, Torus, Vector, export_stl, extrude, loft

import roll_test as rt
from roll_test import BEAM, BEAM_Z, BLK, RAIL, S0, T, W, YCYL, box, nothing, prism, render, unbridged, yz_prism

E_L = (10.0, 15.0)                # the opening's left edge from L's left face (user 2026-10-17: "around 1-1.5 cm"): checked at both
Z_BAR = 10.0                      # EST: the frame's bar top above the tunnel floor (user 2026-10-16: the floor is ~10 below it)
TOP = rt.MOUTH_CLEAR - rt.CLR_TOP  # L's flat top (52): the opening's height less 3 (user may allow more: lead 2026-10-18)
T_LID, C = 1.6, 0.2
YR = -69.6                        # the box's right wall's inner face (0.6 + 1.2 clear of R's bridges at -71.4)


def xz_prism(pts, y0, y1):        # XZ polygon (s, z) extruded along y from y0 to y1
    return Pos(0, y0, 0) * extrude(Plane.XZ * Polygon(*pts, align=None), y1 - y0, dir=(0, 1, 0))


def frustum(s0, s1, y, z, h0, h1):   # square frustum along s: half-width h0 at s0, h1 at s1
    return loft([Plane(origin=(s0, y, z), z_dir=(1, 0, 0)) * Rectangle(2 * h0, 2 * h0),
                 Plane(origin=(s1, y, z), z_dir=(1, 0, 0)) * Rectangle(2 * h1, 2 * h1)])


# ---- the parts (electronics/dimensions.md, battery-drawer-electrical-2026-10-17.md) ---------------------------------
BD = (70.0, 30.0, 1.6)            # perfboard
LANE = (11.7, 31.2, -21.0, -72.0, 120.7, 5.0)   # drawer lane: floor z, top z (the dash's underside), y (its right wall
                                                 # under the rail), back wall s, its thickness
B0 = (LANE[4] + LANE[5] + 0.3, -44.8, 8.4)   # board's x = 0 / y = 0 corner (USB end, header edge) in s, y; underside z
                                              # (S34: a plug run along the lane's left wall, over its key, meets the port)
B_TOP = B0[2] + BD[2]
USB = (B0[0] + 1.4, B0[1] + 16.1, B_TOP + 5.7)          # receptacle face s, centre y, z: a plug resting on the lane floor (S30)
USB_CUT = (14.0, 8.5)
PINS = [(B0[0] + 66.5, B0[1] + y) for y in (3.5, 26.5)]   # Ø7 bosses under both holes; a pin only in the first (B15)
HOLDER = (68.0, 47.0, 17.0)       # FIT0610
KEY = 1.5                         # the drawer's bottom-left chamfer: it keys it (S28: with the lane 2.4 right of the
                                  # first draft, the corner clears the opening's R10 corner by > 1 at e_L 15)
# battery lead (lead 2026-10-18: a wired lead to a JST-PH pair, no contacts). It rolls in a U in the channel under the rail, right
# of the lane: the lower strand lies still on a ledge, the upper one rides with the drawer from a tab on its rear corner
# through a slit in the lane's right wall, and the bend rolls at half the drawer's speed. Pushing the drawer in pulls the
# upper strand (tension): nothing can buckle into the drawer's path. The loop stays above the bar (z >= 10)
LEAD = (2.8, 11.9, 25.9, -76.7)   # the lead as a tube Ø (Adafruit 6181 24 AWG silicone, a 2.8 x 1.4 flat pair: Ø2.8 is its
                                  # envelope), lower / upper strand centre z (bend r 7 about the thin axis), centre y
LEAD_R_MIN = 7.0                  # the pair's dynamic bend radius (electronics: 5 x 1.4)
# the drawer's stop (R2-S2): a Ø1 nonconductive cord (braided polyester / Dyneema) beside the lead, rolling in the same U.
# Tied to the ledge and the tab, it runs out of U at 125 out, while the lead still has 6 + its bend to spare
TETHER = (1.2, LEAD[3] + 2.5)     # cord envelope Ø, its y
CATCH = (0.2, 0.15)               # latch slack from the stop to the catch
SO = 0.0                          # the drawer's rear face stops on the lane's back wall
DR = (36.0, 45.0, LANE[4] - SO, -21.3, -71.7, 12.0, 30.9)   # drawer: front face s, front block's back s, rear face s, y, z
A_S = DR[2] - 3.5                 # the lead's tab on the drawer (s, home); the tether ties at its front, A_S - 4.5
HOLDER_LEAD = 40.0                # the holder's own lead to the joint: lets it lift out of the tray (S41, >= 36)
# J_BAT (electronics, round 3): a JST-PH 2-pin cable pair; its pigtail is soldered at board holes (17,0)/(19,0) and the
# mated pair (18 x 7.5 x 5.5) lies in a pocket beside the board's bottom edge, along y, the battery lead's end outward
PH = (18.0, 7.5, 5.5)
JP = (B0[0] + 5.8 + 2.54 * 17, B0[1] - 1.5 - 1.2 - PH[0] / 2)   # the pocket's centre (s, y)
J_BAT = (JP[0], JP[1] - PH[0] / 2, 1.2 + PH[2] / 2)               # the battery lead leaves the mated pair here
DASH = (36.0, 66.0, LANE[1])      # dash: front s, rear s, underside z
BTN = (-23.5, 42.5)               # undo key centre y, z (left of the OLED; r >= 23.5 so a fingertip clicks it: S37)
MX = (14.0, 1.5, 15.6, 11.0, 6.6, 11.6, 11.6, 4.0)   # MX Blue (EST): plate cut-out, plate, housing at the plate / at its top,
                                  # housing above the plate, stem top above the plate, depth behind the plate (pins), travel
KC = (10.0, 2.0, 2.75, 3.6)       # printed keycap: square, face, hub radius, socket depth (an 18 one isn't inside the opening)
SP = (S0 + KC[1] + MX[5],)        # switch plate's front face (s): the cap's face flush with L's face (S37)
OL = (36.0, 12.5, 4.0, 22.38, 5.58, 3.8)   # 0.91" 128 x 32 OLED (Waveshare 14657; active offset EST), upright: module y, z, depth; active y, z; active's left edge
                                  # from the module's left end (centred on its ~30 glass, away from the pins: electronics)
OL_Y0 = -32.5                     # the module's left end (y); its pins are at the right end, over the bay
BAY = (-59.4, -68.4, 32.4, 51.0)  # receiver bay: inner y (9.6: it bridges in print), floor z, back-wall s (R's lead
                                   # drops straight in at s 52-55)
HDR = (7.62, 2.54, 2.5)           # 3-pin male header body (pin 3 pulled; S23): y, z, s
HDR_Y = (BAY[0] + BAY[1]) / 2
PULL = (40.0, 55.0, 14.0, 28.0)   # service grip: a window in the lane's right wall (s, z) into the empty space under the
                                  # rail: drawer out, a finger curls in and pulls / lifts on L itself (not the dash or lid)
BUZ = (58.5, -45.0)               # buzzer centre s, y: in the block under the OLED, port up into its open room (behind
                                  # the LED channels, S38)
EM = (2.5, 2.9, 7.7, 1.0, 12.0)   # TSAL6200: body r, flange r, tip -> flange top, flange, tip behind the aperture
EM_TIP = -BLK + EM[4]
EM_FL = EM_TIP + EM[2]
LANT = (B0[0] + 18, B0[0] + 22)   # XIAO antenna, x 18-22
DRAWER_OUT = Pos(-125.0, 0, 0)    # the drawer pulled out, holder clear of the frame (s < 0): for renders and the film

# ---- L: roll_test's shell, with a flat-topped box -------------------------------------------------------------------
inner = box(S0, 200.2, -T, 0, 0, TOP)                                              # left wall up to the flat top
LB = LANE[4] + LANE[5]           # the lane's end: beside it the right wall rises from a 45 deg shelf over the lane
inner += box(LB, 200.2, YR, YR - 1.2, 0, TOP) + box(LB, 200.2, YR, -BLK + RAIL[0], 0, 40)   # right wall
inner += box(S0, LB, YR, YR - 1.2, 34.8, TOP) + box(S0, LB, YR, -BLK + RAIL[0], 34.8, 40) + \
    yz_prism([(LANE[3] - 1.2, LANE[1] - 1.2), (YR, LANE[1] + 2.4), (YR, LANE[1] + 3.6), (LANE[3] - 1.2, LANE[1] + 3.6)], S0, LB)
inner += box(199.0, 200.2, -T, YR, 0, TOP)                                          # rear wall (the roof starts behind it)
# drawer lane: shelf on ribs along s, left wall, keyed chamfer, a 5 mm back wall with the USB funnel
inner += box(S0 + T, LANE[4], LANE[2], LANE[3], LANE[0] - 1.2, LANE[0])
inner += box(S0, LB, LANE[3], LANE[3] - 1.2, 0, LANE[1])                           # the lane's right wall
for y in (-31.0, -44.0, -57.0):
    inner += box(S0 + T, LANE[4], y, y - 1.2, 0, LANE[0] - 1.2)
inner += box(S0, LANE[4] + LANE[5], LANE[2] + 1.2, LANE[2], 0, LANE[1])
inner += yz_prism([(LANE[2], LANE[0]), (LANE[2] - KEY + 0.3, LANE[0]), (LANE[2], LANE[0] + KEY - 0.3)], S0, LANE[4])
inner += box(LANE[4], LB, LANE[2], LANE[3], 0, LANE[1])
# board: end rail, edge strips, Ø7 bosses tied low to the back stop (N18), one pin, lips, clips
STOP = B0[0] + BD[0] + 0.3
inner += box(STOP, STOP + 1.2, B0[1] - 2, B0[1] + BD[1] + 2, 0, B_TOP + 3)
inner += box(B0[0] + 0.5, B0[0] + 4, B0[1], B0[1] + BD[1], 0, B0[2])
for y0 in (0.0, BD[1] - 1.5):
    inner += box(B0[0] + 0.5, PINS[0][0] - 3.5, B0[1] + y0, B0[1] + y0 + 1.5, 0, B0[2])
for s, y in PINS:
    inner += Pos(s, y, 0) * Cylinder(3.5, B0[2], align=rt.MINB) + box(s, STOP, y - 2.0, y + 2.0, 0, B0[2] - 3.5)
inner += Pos(*PINS[0], 0) * Cylinder(1.4, B_TOP + 2.0, align=rt.MINB)
for s in (B0[0] + 20, B0[0] + 45):                                     # lips over the socket edge
    inner += box(s - 3, s + 3, B0[1] + BD[1] + 0.3, B0[1] + BD[1] + 1.9, 0, B_TOP + 1.0)
    inner += box(s - 3, s + 3, B0[1] + BD[1] - 0.6, B0[1] + BD[1] + 0.3, B_TOP + 0.1, B_TOP + 1.0)
for s in (B0[0] + 24, B0[0] + 60):                                     # snap clips on the header edge
    inner += box(s - 3, s + 3, B0[1] - 0.3, B0[1] - 1.9, 0, B_TOP + 1.1)
    inner += yz_prism([(B0[1] - 0.3, B_TOP + 0.1), (B0[1] + 0.5, B_TOP + 0.1), (B0[1] + 0.5, B_TOP + 0.3),
                       (B0[1] - 0.3, B_TOP + 1.1)], s - 3, s + 3)
# the emitter block; 45 deg corbels for the lid (left and right walls) and the dash (left wall)
inner += box(BEAM - 6, BEAM + 6, EM_FL + EM[3] + 2.2, -BLK, 0, 25)
Z1 = TOP - T_LID
for y0, d in ((-T, -2.0), (YR, 2.0)):
    inner += yz_prism([(y0, Z1 - 2), (y0 + d, Z1), (y0, Z1)], DASH[1], 199.0)
inner += yz_prism([(-T, DASH[2] - 2), (-T - 2, DASH[2]), (-T, DASH[2])], S0 + T, DASH[1])
part_l = rt.l_shell(inner)

# the roof and its front wall go from s 194-199 (the box reaches s 199; the emitter block stays); the front wall stops
# under the dash; cuts: the lane opening (keyed, with a lead-in), the latch notch, USB funnel + cut, R's lead
part_l -= box(BEAM - 0.01, 199.0, -T, EM_FL + EM[3] + 2.2, 0.5, 100) + box(BEAM - 0.01, 199.0, EM_FL + EM[3] + 2.2, YR, 25, 100)
part_l -= box(S0 - 1, S0 + T + 0.01, -T, YR, DASH[2], 100) + box(S0 - 1, S0 + T + 0.01, YR, LANE[3], LANE[0], LANE[1])
lane_pts = [(LANE[2], LANE[0] + KEY - 0.3), (LANE[2] - KEY + 0.3, LANE[0]), (LANE[3], LANE[0]), (LANE[3], LANE[1]), (LANE[2], LANE[1])]
part_l -= Pos(S0 - 1, 0, 0) * extrude(Plane.YZ * Polygon(*lane_pts, align=None), T + 2, dir=(1, 0, 0))
part_l -= yz_prism([(LANE[3], LANE[1]), (YR, LANE[1]), (YR, LANE[1] + 2.4)], S0 - 1, S0 + T + 0.01)   # the front
                                                                                  # wall follows the shelf's 45 deg underside
for y0, d in ((LANE[2], 1.0), (LANE[3], -1.0)):                                  # N21: 45 deg lead-ins at the mouth
    part_l -= prism([(S0 - 0.01, y0 + d), (S0 + 1.0, y0), (S0 - 0.01, y0)], LANE[0] + KEY, LANE[1])
LATCH = (50.0, 53.0, 23.0, 28.0, 0.9, 60.0)   # the detent: its bump's s, its notch's z, the bump's height, its holding flank
B0S = LATCH[0] + 0.2              # the bump's base, its holding (-s) flank first: at home that flank meets the notch's front
NF = B0S + (LANE[2] - DR[3]) / math.tan(math.radians(LATCH[5])) - CATCH[0]   # edge after CATCH[0] of travel (B16)
part_l -= box(NF, LATCH[1] + 0.5, LANE[2] + 1.3, LANE[2] - 0.1, LATCH[2], LATCH[3])
part_l -= box(PULL[0], PULL[1], LANE[3] + 0.1, LANE[3] - 1.3, PULL[2], PULL[3])  # service grip (its top bridges 15)
part_l -= prism([(LANE[4] - 0.01, USB[1] - 8.0), (LANE[4] + 2.0, USB[1] - USB_CUT[0] / 2), (LANE[4] + 2.0, USB[1] + USB_CUT[0] / 2),
                 (LANE[4] - 0.01, min(USB[1] + 8.0, LANE[2]))], LANE[0] - 0.25, LANE[0] + 9.75)   # funnel: flush with the lane's left wall (the
                                                                                  # plug rides it), tapered on the right
part_l -= box(LANE[4] + 1.9, LANE[4] + LANE[5] + 0.1, USB[1] - USB_CUT[0] / 2, USB[1] + USB_CUT[0] / 2,
              USB[2] - USB_CUT[1] / 2, USB[2] + USB_CUT[1] / 2)
YIN = -BLK + T                    # the lead's channel: lane's right wall .. L's right wall, over a ledge at z 10.5
part_l += box(S0 + T, LB, LANE[3], YIN, LEAD[1] - 2.6, LEAD[1] - 1.4) + box(LB, 172.0, YR - 1.2, YIN, LEAD[1] - 2.6, LEAD[1] - 1.4)
part_l -= yz_prism([(LANE[3] + 0.1, LEAD[2] - 4.6), (LANE[3] - 1.3, LEAD[2] - 4.6), (LANE[3] - 1.3, LEAD[2] + 2.8),
                    (LANE[3] + 0.1, LEAD[2] + 1.4)], S0 - 1, LANE[4] + 0.01)      # slit for the tab (45 deg top)
part_l -= box(S0 - 1, S0 + T + 0.01, LANE[3] - 1.2, YIN, LEAD[1] - 1.4, LEAD[2] + 2.8)   # the loop's mouth in the front wall
part_l -= prism([(S0 - 0.01, YIN - 0.8), (S0 + 1.0, YIN), (S0 - 0.01, YIN)], LEAD[1] - 1.4, LEAD[2] + 2.8)   # lead-in
part_l -= box(JP[0] - 4.0, JP[0] + 4.0, YR + 0.1, -BLK + RAIL[0] - 0.1, LEAD[1] - 1.4, LEAD[1] + 4.0)   # notch: lead to J_BAT
part_l += box(JP[0] - PH[1] / 2 - 1.2, JP[0] + PH[1] / 2 + 1.2, B0[1] - 1.5, JP[1] - PH[0] / 2 - 1.2, 0, 1.2 + PH[2] * 0.7) - \
    box(JP[0] - PH[1] / 2 - 0.2, JP[0] + PH[1] / 2 + 0.2, B0[1] - 2.6, JP[1] - PH[0] / 2 - 0.2, 1.2, 50) - \
    box(JP[0] - 2.0, JP[0] + 2.0, JP[1] - PH[0] / 2 + 0.1, JP[1] - PH[0] / 2 - 1.4, 1.2, 50)   # J_BAT pocket, a lead slot out
for s in (150.0, 154.0):                                                           # the tether's anchor: down one, up the other
    part_l -= Pos(s, TETHER[1], 0) * Cylinder(1.0, 20, align=rt.MINB)
for y in (LEAD[3] + 2.6, LEAD[3] - 2.6):                                           # zip-tie slots: strain relief at J_BAT
    part_l -= box(158.0, 161.0, y - 0.8, y + 0.8, LEAD[1] - 3, LEAD[1])
part_l -= box(45.0, 57.0, YR + 0.1, -BLK + RAIL[0] - 0.1, 40.0, 100)              # R's lead drops into the bay here
# windows: the dash's snap bumps (left and right walls), the lid's rear lips (rear wall)
SNAP = [(-T, (39.0, 43.0)), (YR, (39.0, 43.0))]   # the right one is in the bay's right wall
for y0, (s0, s1) in SNAP:
    part_l -= box(s0, s1, y0 + 0.1 if y0 == YR else y0 - 0.1, y0 - 1.3 if y0 == YR else y0 + 1.3, 42.0, 44.4)
HOOKS = [(-30.0, -44.0), (-50.0, -64.0)]   # windows above the roof behind (on the left they'd cut its edge)
for y0, y1 in HOOKS:
    part_l -= box(198.9, 200.3, y0 + 0.3, y1 - 0.3, Z1 - 3.2, Z1 - 1.6)
part_l -= YCYL(BEAM, -BLK - 1, BEAM_Z, 1.5, EM[4] + 1)                            # emitter: Ø3 aperture tube, trough
for y0, y1, r in ((EM_TIP, EM_FL, EM[0] + 0.15), (EM_FL, EM_FL + EM[3] + 0.4, EM[1] + 0.25),
                  (EM_FL + EM[3] + 0.4, EM_FL + EM[3] + 2.3, EM[0] + 0.15)):
    part_l -= YCYL(BEAM, y0, BEAM_Z, r, y1 - y0) + box(BEAM - r, BEAM + r, y0, y1, BEAM_Z, 100)

# ---- the drawer (printed on its floor): front block with a finger pocket + glyph, tray, latch arm, retention tabs,
# the lead's tab; the FIT0610 lies in it, cover up
dr_pts = [(DR[3], DR[5] + KEY), (DR[3] - KEY, DR[5]), (DR[4], DR[5]), (DR[4], DR[6]), (DR[3], DR[6])]
dr_env = Pos(DR[0], 0, 0) * extrude(Plane.YZ * Polygon(*dr_pts, align=None), DR[2] - DR[0], dir=(1, 0, 0))
drawer = dr_env & (box(DR[0], DR[1], 0, -100, 0, 100) + box(DR[1], DR[2], 0, -100, DR[5], DR[5] + 1.2) +
                   box(DR[1], DR[2], DR[3], DR[3] - 1.2, DR[5], DR[6] - 0.2) + box(DR[1], DR[2], DR[4], DR[4] + 1.2, DR[5], DR[6] - 0.2) +
                   box(DR[2] - 1.2, DR[2], 0, -100, DR[5], DR[5] + 12))           # front block, floor, side walls, rear wall
HY = (DR[3] - 1.7, DR[3] - 1.7 - HOLDER[1])                                       # holder's y range (0.5 a side)
HS = (DR[1] + 0.5, DR[1] + 0.5 + HOLDER[0])
holder = box(*HS, *HY, DR[5] + 1.2, DR[5] + 1.2 + HOLDER[2])
H_TOP = DR[5] + 1.2 + HOLDER[2]
fuse = box(HS[1] + 0.8, HS[1] + 5.2, -48.5, -59.5, DR[5] + 1.4, DR[5] + 5.8)   # a pico fuse in the + lead (Ø4 x 10,
                                                                                # heat-shrunk; ee2-opus-r2), beside the joint
for s in (82.0, 104.0):           # retention: 12-wide tabs in the side walls, 0.5 lips over the holder's top edges
    for y0, d in ((DR[3], -1), (DR[4], 1)):
        drawer -= box(s - 6.4, s - 6.0, y0 + 0.1 * d, y0 + 1.3 * d, DR[5] + 6, 50) + box(s + 6.0, s + 6.4, y0 + 0.1 * d,
                                                                                       y0 + 1.3 * d, DR[5] + 6, 50)
        drawer += box(s - 6.0, s + 6.0, y0 + 1.2 * d, y0 + 2.1 * d, H_TOP + 0.05, H_TOP + 0.55)
drawer -= box(DR[0] - 1, DR[0] + 2.0, -35.0, -53.0, 13.5, 23.5)                   # finger pocket: opening 18 x 10,
drawer -= box(DR[0] + 2.0, DR[0] + 8.0, -35.0, -53.0, 13.5, 29.5)                 # 8 deep, a lip to hook behind (S29)
drawer -= xz_prism([(DR[0] - 0.01, 23.5), (DR[0] + 2.01, 23.5), (DR[0] + 2.01, 25.6)], -53.0, -35.0)
ZA = DR[5] + KEY + 1.2                                                            # the latch arm: 20 long, the left wall
ARM = 1.6                         # the latch arm's thickness (the side wall is 1.2)
drawer += box(LATCH[0] - 0.2, LATCH[1] + 17.0, DR[3] - 1.2, DR[3] - ARM, ZA + 2.2, DR[6] - 0.2)
drawer -= box(LATCH[0] - 1.0, LATCH[0] - 0.2, DR[3] + 0.1, DR[3] - 1.7, ZA, 50)   # above the keyed corner, free at its front,
drawer -= yz_prism([(DR[3] + 0.1, ZA), (DR[3] + 0.1, ZA + 0.8), (DR[3] - 1.7, ZA + 2.6), (DR[3] - 1.7, ZA + 1.8)],
                   LATCH[0] - 1.0, LATCH[1] + 17.0)                                # a 45 deg slot under it (prints), top free
lh, lt = LATCH[4], LATCH[4] / math.tan(math.radians(LATCH[5]))
latch_bump = prism([(B0S, DR[3]), (B0S + lt, DR[3] + lh), (B0S + lt + 1.5, DR[3] + lh), (B0S + lt + 1.5 + lh, DR[3])],
                   LATCH[2], LATCH[3])                                             # holding flank 60 deg, lead-in 45 deg
drawer += latch_bump
glyph = box(DR[0] - 0.6, DR[0] + 0.01, -57.0, -64.0, 16.0, 16.8) + box(DR[0] - 0.6, DR[0] + 0.01, -57.0, -64.0, 20.2, 21.0) + \
    box(DR[0] - 0.6, DR[0] + 0.01, -57.0, -57.8, 16.0, 21.0) + box(DR[0] - 0.6, DR[0] + 0.01, -63.2, -64.0, 16.0, 21.0) + \
    box(DR[0] - 0.6, DR[0] + 0.01, -64.0, -65.0, 17.5, 19.5) + box(DR[0] - 0.6, DR[0] + 0.01, -66.0, -68.6, 18.1, 18.9) + \
    box(DR[0] - 0.6, DR[0] + 0.01, -66.9, -67.7, 17.2, 19.8)                     # battery glyph ▭+ (ux), 0.6 proud
drawer += glyph
# the lead's tab: through the slit, an open-top groove the lead is glued in (its strain relief), a 45 deg underside
# (prints). The joint with the holder's own lead lies loose behind the holder (S40: no posts)
tab = yz_prism([(DR[4] + 1.0, LEAD[2] - 4.4), (DR[4] + 1.0, LEAD[2] + 1.3), (LEAD[3] + 1.6, LEAD[2] + 1.3),
                (LEAD[3] + 1.6, LEAD[2] - 1.0), (DR[4], LEAD[2] - 4.4)], A_S - 4.5, A_S + 2.5)
drawer += tab
drawer -= box(A_S - 1.6, A_S + 1.6, DR[4] + 1.3, LEAD[3] - 1, LEAD[2] - 1.5, 50)          # through the side wall too
drawer -= Pos(A_S - 4.6, TETHER[1], LEAD[2]) * Rot(0, 90, 0) * Cylinder(0.7, 3.1, align=rt.MINB)   # the tether's hole (Ø1.4: prints)


def seg(a, b, d=LEAD[0]):         # a round segment a -> b
    v = Vector(*b) - Vector(*a)
    if v.length < 1e-3:           # the tether, fully out: no upper strand left
        return Pos(*b) * Sphere(d / 2)
    return Solid.make_cylinder(d / 2, v.length, Plane(origin=a, z_dir=v)) + Pos(*b) * Sphere(d / 2)


def lead_pts(d):                  # the battery lead's path, drawer out by d: J_BAT .. ledge .. the U .. the tab .. holder
    a, b = A_S - d, A_S - 68.5 - d / 2   # the tab; the bend rolls at half speed, 6 ahead of the tab when fully out
    y = LEAD[3]
    fixed = [J_BAT, (JP[0], YR + 1.0, LEAD[1]), (JP[0] - 3.0, y, LEAD[1]), (b, y, LEAD[1])]
    moving = [(b, y, LEAD[2]), (a, y, LEAD[2]), (a, DR[4] + 1.5, LEAD[2]), (a - 3, -63.0, 20.0)]
    return fixed, moving, b


# the cord (R3-S2): cut so it is TAUT at 125 out, from the top of its ledge hole at s 150 (under the ledge to s 154 and a
# knot: not counted) through the tab's hole to the knot in its groove. Shorter, its slack stores as a U (r 7.4) while it
# fits, then as a J: along the ledge, then rising to the tab
TZ = (TETHER[1], 10.5 + TETHER[0] / 2, LEAD[2])   # its y, lower z (on the ledge), upper z (the tab's hole)


def _tab(d):                      # the cord's entry into the tab, and its knot
    return (A_S - 4.5 - d, TZ[0], TZ[2]), (A_S - 1.6 - d, TZ[0], TZ[2])


def _plen(pts):
    return sum((Vector(*q) - Vector(*p)).length for p, q in zip(pts, pts[1:]))


E1 = (150.0, TZ[0], TZ[1])
CORD_L = _plen([E1, *_tab(125.0)])   # taut at 125


def tether_pts(d):                # -> its polyline, and the U's bend s (None in the J phase or taut)
    f, k = _tab(d)
    r = (TZ[2] - TZ[1]) / 2
    b = (E1[0] + k[0] + math.pi * r - CORD_L) / 2                      # the U: (150 - b) + pi r + (k - b) = CORD_L
    if b <= f[0]:
        return [E1, (b, TZ[0], TZ[1]), (b, TZ[0], TZ[2]), f, k], b
    lo, hi = f[0] - 40.0, E1[0]                                        # the J: on the ledge to p, then up to the tab
                                                                       # (p < f: a shrinking U, drawn as a straight rise)
    for _ in range(60):
        p_ = (lo + hi) / 2
        if _plen([E1, (p_, TZ[0], TZ[1]), f, k]) > CORD_L:
            lo = p_
        else:
            hi = p_
    return [E1, (hi, TZ[0], TZ[1]), f, k], None


def tether_len(d):
    pts, b = tether_pts(d)
    if b is None:
        return _plen(pts)
    return _plen(pts[:2]) + math.pi * (TZ[2] - TZ[1]) / 2 + _plen(pts[2:])


def tether_tube(d):
    pts, b = tether_pts(d)
    if b is None:
        return sum((seg(p, q, TETHER[0]) for p, q in zip(pts[1:], pts[2:])), seg(pts[0], pts[1], TETHER[0]))
    r = (TZ[2] - TZ[1]) / 2
    bend = (Pos(b, TZ[0], TZ[1] + r) * Rot(90, 0, 0) * Torus(r, TETHER[0] / 2)) & box(b - r - 2, b, -200, 50, -10, 100)
    return sum((seg(p, q, TETHER[0]) for p, q in (pts[:2], pts[2:4], pts[3:5])), bend)


def lead_slack(d):                # how much further the lead could go than its stored path allows: straightened U
    fixed, moving, b = lead_pts(d)
    return lead_len(d) - _plen([fixed[0], fixed[1], fixed[2], moving[1], moving[2], moving[3]])


def lead_tube(d):
    fixed, moving, b = lead_pts(d)
    r = (LEAD[2] - LEAD[1]) / 2
    bend = (Pos(b, LEAD[3], LEAD[1] + r) * Rot(90, 0, 0) * Torus(r, LEAD[0] / 2)) & box(b - r - 2, b, -200, 50, -10, 100)
    return sum((seg(p, q) for pts in (fixed, moving) for p, q in zip(pts, pts[1:])), bend)


def lead_len(d):
    fixed, moving, _ = lead_pts(d)
    return sum((Vector(*q) - Vector(*p)).length for pts in (fixed, moving) for p, q in zip(pts, pts[1:])) + \
        math.pi * (LEAD[2] - LEAD[1]) / 2


LEAD_LEN = lead_len(0)            # J_BAT's plug to the holder's joint
lead_home, lead_half, lead_out = lead_tube(0.0), lead_tube(62.5), lead_tube(125.0)

# ---- the dash (printed on its front face): button ring + hollow, tilted OLED pocket + window (the module goes in from
# the open rear, glued), receiver bay (back wall with the header slot, R's lead drops in through a notch), buzzer sleeve
# + grille, snap arms in 1.0 walls, the lid tab's window, wire channels into the hidden strip (S31)
ds, de = DASH[0], DASH[1]
dash = box(ds, de, -T - C, YR + C, DASH[2], TOP)
# the OLED: upright behind a window in the dash front, in a pocket open behind (it goes in from the back), held by
# 0.8 lips on its long edges (45 deg lead-ins); the bay runs under its right end
OZ = TOP - 1.2 - OL[1] - 0.3                                                      # module's underside z
oy = (OL_Y0 - OL[0], OL_Y0)
module = box(ds + T + 0.05, ds + T + 0.05 + OL[2], *oy, OZ, OZ + OL[1])
ay = (OL_Y0 - OL[5] - OL[3], OL_Y0 - OL[5])
az = (OZ + (OL[1] - OL[4]) / 2, OZ + (OL[1] + OL[4]) / 2)
active = box(ds + T + 0.04, ds + T + 0.06, *ay, *az)
dash -= box(ds + T, ds + T + OL[2] + 0.1, oy[0] - 0.2, oy[1] + 0.2, OZ - 0.2, TOP + 1)      # a slot: it drops in from the top
dash -= box(ds + T + OL[2] + 0.1, de + 1, oy[0] + 0.8, oy[1] - 0.8, OZ - 0.2, TOP + 1)   # room behind for pins + lead;
                                                                                  # 0.8 rails behind its ends hold it (S35)
dash -= box(ds - 1, ds + T + 0.01, ay[0] - 0.5, ay[1] + 0.5, az[0] - 0.5, az[1] + 0.5)              # window
# Waveshare 14657 (R2-B2): its PH2.0 socket (back, right end, plug along the module's axis) can't take a plug here (~1
# free at either end vs ~10): it stays unused in a pocket, a 0.9 rib behind it is the right end's stop. The lead is
# 4 x 28 AWG soldered into the 2.54 holes at the left end, flat on the back, back to the channel (electronics)
OPH = (2.2, 4.8, 7.6, 9.9)        # socket: PCB back behind the module's face, its height off the PCB, length, width (EST)
ol_socket = box(ds + T + 0.05 + OPH[0], ds + T + 0.05 + OPH[0] + OPH[1], oy[0], oy[0] + OPH[2],
                OZ + (OL[1] - OPH[3]) / 2, OZ + (OL[1] + OPH[3]) / 2)
osb = ol_socket.bounding_box()
dash -= box(ds + T, osb.max.X + 0.2, oy[0] - 0.2, osb.max.Y + 0.3, osb.min.Z - 0.3, TOP + 1)   # open on top: drops in
ol_lead = box(ds + T + 0.05 + OL[2], 60.5, OL_Y0 - 0.9, OL_Y0 - 2.3, OZ + 1.5, TOP - 2.5)   # 4 wires from the holes
# button: window, ring, a hollow behind the ring ending in a 45 deg point, a wire slot down at its left edge
# undo key (MX Blue + printed cap): the cap runs in an 11 tunnel; a chamber for the switch's top housing; a slot for its
# separate 1.5 plate (it slides up from below with the switch clipped in; pressing the cap on locks it); room behind
# for the bottom housing + pins, open below and out the back; the leads go down at its left into the hidden strip
ky = (BTN[0] - KC[0] / 2 - 0.5, BTN[0] + KC[0] / 2 + 0.5)
dash -= box(ds - 1, SP[0] - MX[4], ky[0], ky[1], BTN[1] - KC[0] / 2 - 0.5, BTN[1] + KC[0] / 2 + 0.5)          # tunnel
dash -= frustum(ds - 0.01, ds + 1.0, BTN[0], BTN[1], KC[0] / 2 + 1.51, KC[0] / 2 + 0.5)                      # 1 x 45 deg mouth
dash -= box(SP[0] - MX[4], SP[0], BTN[0] - 8.0, BTN[0] + 8.0, DASH[2] - 1, BTN[1] + 8.0)                       # chamber
dash -= box(SP[0] - MX[5] - 0.2, SP[0] - MX[4] + 0.01, BTN[0] - 2.2, BTN[0] + 2.2, DASH[2] - 1, BTN[1])   # the stem's way up
dash -= box(SP[0], SP[0] + MX[1] + 0.1, BTN[0] - 8.1, BTN[0] + 8.1, DASH[2] - 1, BTN[1] + 8.1)                # plate slot
dash -= box(SP[0] + MX[1], de + 1, BTN[0] - 7.15, BTN[0] + 7.15, DASH[2] - 1, BTN[1] + 8.1)                    # behind it (1.0 side shoulders hold the plate)
# wire channel along y behind the module: OLED pins and the J_PT extension to the left, down the button's slot
dash -= xz_prism([(59.9, TOP - 6.2), (64.1, TOP - 6.2), (59.9, TOP - 2.0)], HDR_Y - 1.0, BTN[0] + 7.0)   # 45 deg back face
# buzzer: stands in a sleeve in the block under the OLED's room (0.4 floor above the lane), port 1.8 up into the open
# room (no grille needed), a 45 deg point toward the rear (it prints); its leads go up into the room
BZ0 = DASH[2] + 0.4 + 1.5                                                         # its underside (pins bent flat under it)
dash -= Pos(BUZ[0], BUZ[1], DASH[2] + 0.4) * Cylinder(6.15, OZ - DASH[2], align=rt.MINB) + \
    prism([(BUZ[0], BUZ[1] + 6.15), (BUZ[0] + 6.15 * 1.414, BUZ[1]), (BUZ[0], BUZ[1] - 6.15)], DASH[2] + 0.4, OZ)
buzzer = Pos(BUZ[0], BUZ[1], BZ0) * Cylinder(6.0, 9.0, align=rt.MINB)
# bay: open in front (under the OLED) and on top behind the OLED; right wall 1.0 with a notch where R's lead drops in;
# back wall + header slot; R's pair U-turns over the plug inside the bay (assembly-review)
dash -= box(ds - 1, BAY[3], BAY[0], BAY[1], BAY[2], OZ - 1.2) + box(ds + T + OL[2] + 1.7, BAY[3], BAY[0], BAY[1], BAY[2], TOP + 1)
dash -= box(45.0, BAY[3] - 0.2, BAY[1] + 0.1, YR, 40.0, TOP + 1)
dash -= box(BAY[3] + 0.8, BAY[3] + 3.3, HDR_Y - 3.9, HDR_Y + 3.9, BAY[2], TOP + 1)     # header body, dropped in
dash -= box(BAY[3] - 0.1, BAY[3] + 0.9, HDR_Y - 3.55, HDR_Y + 3.55, BAY[2], TOP + 1)   # pins: the ledges beside < 1
dash -= box(BAY[3] + 3.2, 64.0, HDR_Y - 3.3, HDR_Y + 3.3, BAY[2], TOP + 1)             # tails + leads, into the channel
# snap arms (along z, flexing across y) in 1.0 walls, bumps 0.6 into L's wall windows, 45 deg both ways
for y0, (s0, s1) in SNAP:
    d = 1 if y0 == -T else -1
    yo = y0 - C * d
    dash -= box(s0 - 1.4, s1 + 1.4, yo - 1.0 * d, yo - 3.0 * d, 40.2, 49.0)       # room to flex (the wall's 1.0)
    dash -= box(s0 - 1.4, s0 - 0.6, yo + 0.1 * d, yo - 1.1 * d, 40.2, 49.0) + box(s1 + 0.6, s1 + 1.4, yo + 0.1 * d, yo - 1.1 * d, 40.2, 49.0)
    dash -= box(s0 - 1.4, s1 + 1.4, yo + 0.1 * d, yo - 1.1 * d, 40.2, 41.0)
    dash += yz_prism([(yo, 42.2), (yo + 0.6 * d, 42.8), (yo + 0.6 * d, 43.6), (yo, 44.2)], s0 + 0.2, s1 - 0.2)
# status LEDs (DECIDE 2026-10-18, ux/status-led-2026-10-18.md): 3 mm diffused, green left + red right, 6 apart, centred
# under the OLED window; face 0.5 behind a Ø3.1 hole, flange on a step; each drops into an open-top channel behind
# the OLED's underside block from the room behind the OLED, then slides forward (its leads stay off the lane)
LEDS = [((ay[0] + ay[1]) / 2 + 3.0, 36.0), ((ay[0] + ay[1]) / 2 - 3.0, 36.0)]   # (y, z): green, red
LED = (0.5, 5.3, 1.0)             # face recess, tip -> flange, flange thickness
XL = lambda y, z, s0, s1, r: Pos(s0, y, z) * Rot(0, 90, 0) * Cylinder(r, s1 - s0, align=rt.MINB)   # noqa: E731
for y, z in LEDS:
    fl = ds + LED[0] + LED[1]
    dash -= XL(y, z, ds - 1, ds + T + 0.01, 1.55) + XL(y, z, ds + T, fl + 0.01, 1.65) + XL(y, z, fl, 51.5, 1.95) + \
        box(fl, 51.5, y - 1.95, y + 1.95, z, OZ + 0.5)
leds = [XL(y, z, ds + LED[0], ds + LED[0] + LED[1], 1.5) + XL(y, z, ds + LED[0] + LED[1], ds + LED[0] + LED[1] + LED[2], 1.9) +
        box(ds + LED[0] + LED[1] + LED[2], ds + LED[0] + LED[1] + LED[2] + 1.0, y - 1.5, y + 1.5, z - 0.3, OZ + 3.0)
        for y, z in LEDS]                                                   # leads bent straight up into the room
TABW = (-4.0, -13.0)              # the lid's front tab window in the dash's back wall
dash -= box(de - 1.3, de + 0.1, TABW[0] + 0.5, TABW[1] - 0.5, 40.8, 42.6)

# ---- the undo button's cartridge and cap (separate prints; the cap plain, in a contrasting filament: user) ----------
XB = lambda s0, s1, r: Pos(s0, BTN[0], BTN[1]) * Rot(0, 90, 0) * Cylinder(r, s1 - s0, align=rt.MINB)   # noqa: E731
kc0 = SP[0] - MX[5] - KC[1]                                                       # cap face (s), flush with L's face
keycap = box(kc0, kc0 + KC[1], BTN[0] - KC[0] / 2, BTN[0] + KC[0] / 2, BTN[1] - KC[0] / 2, BTN[1] + KC[0] / 2) + \
    XB(kc0 + KC[1], kc0 + KC[1] + KC[3], KC[2])
keycap -= box(kc0 + KC[1] - 0.01, kc0 + KC[1] + KC[3] + 0.1, BTN[0] - 2.1, BTN[0] + 2.1, BTN[1] - 0.65, BTN[1] + 0.65) + \
    box(kc0 + KC[1] - 0.01, kc0 + KC[1] + KC[3] + 0.1, BTN[0] - 0.65, BTN[0] + 0.65, BTN[1] - 2.1, BTN[1] + 2.1)   # cross socket
sw_plate = box(SP[0], SP[0] + MX[1], BTN[0] - 8.0, BTN[0] + 8.0, BTN[1] - 8.0, BTN[1] + 8.0) - \
    box(SP[0] - 1, SP[0] + MX[1] + 1, BTN[0] - MX[0] / 2, BTN[0] + MX[0] / 2, BTN[1] - MX[0] / 2, BTN[1] + MX[0] / 2)
switch = frustum(SP[0] - MX[4], SP[0], BTN[0], BTN[1], MX[3] / 2, MX[2] / 2) + \
    box(SP[0] + MX[1], SP[0] + MX[1] + MX[6], BTN[0] - 7.0, BTN[0] + 7.0, BTN[1] - 7.0, BTN[1] + 7.0) - \
    XB(SP[0] - MX[4] - 1, SP[0] - MX[4] + KC[3] + 0.5, 3.0)                      # (the cap's hub dips into its top)
switch += box(SP[0] - MX[5], SP[0] - MX[4], BTN[0] - 2.0, BTN[0] + 2.0, BTN[1] - 0.6, BTN[1] + 0.6) + \
    box(SP[0] - MX[5], SP[0] - MX[4], BTN[0] - 0.6, BTN[0] + 0.6, BTN[1] - 2.0, BTN[1] + 2.0)   # stem cross
stem = switch & box(SP[0] - MX[5] - 1, SP[0] - MX[4], -100, 0, 0, 100)
switch_body = switch - stem

# ---- the lid: flat; rear lips into the s 199 wall; a spring tab clicks into the dash's back wall ---------------------
lid = box(de + C, 199.0 - C, -T - C, YR + C, Z1, TOP)
lid -= box(B0[0] + 51, B0[0] + 65, B0[1] + 18, B0[1] + 32, 0, 100)              # over the calibration sockets
FPC = (130.0, 172.0, -3.5, -15.5, 0.3)   # stick-on spot for a U.FL FPC antenna (R2, if the in-table RSSI test wants one)
lid -= box(*FPC[:4], Z1 - 1, Z1 + FPC[4])                                          # under the lid, high above the metal
for y0, y1 in HOOKS:
    lid += box(199.0 - C - T, 199.0 - C, y0, y1, Z1 - 3.0, Z1 + 0.01) + box(199.0 - C, 199.7, y0, y1, Z1 - 3.0, Z1 - 1.8)
t0 = de + C                       # tab: 1.2 thick, ~10 long; its 0.6 lip reaches 0.4 into the dash's back wall (0.7 % strain)
zc = 42.4
lid += box(t0, t0 + 1.2, *TABW, zc - 1.4, Z1 + 0.01)
lid += xz_prism([(t0, zc), (t0 - 0.6, zc), (t0 - 0.6, zc - 0.6), (t0, zc - 1.2)], TABW[1], TABW[0])

# ---- R: the roll test's keeper + a 3.4 x 2 rebate across its front bridge for the receiver pair (S25) -----------------
RB = (rt.S_PEGS[0] - rt.BRIDGE_H[0], 3.4, 2.0)
part_r = rt.part_r - box(RB[0] - 1, RB[0] + RB[1], -BLK + RAIL[0] + 1, -W + 2.0, rt.H_TOP - RB[2], rt.H_TOP + 1)
pair_bridge = box(RB[0] + 0.1, RB[0] + 3.3, -BLK + RAIL[0], -W + 2.4, rt.H_TOP - 1.8, rt.H_TOP - 0.2)
pair_climb = box(RB[0] - 1.8, RB[0] - 0.1, *rt.W_Y, rt.Z_LD + 0.1, rt.H_TOP - 0.3)
cart = rt.cart

# ---- dummies: the electronics (checks + renders) --------------------------------------------------------------------
board = box(B0[0], B0[0] + BD[0], B0[1], B0[1] + BD[1], B0[2], B_TOP)
for s, y in PINS:
    board -= Pos(s, y, 0) * Cylinder(1.6, 100, align=rt.MINB)
xiao = box(USB[0], USB[0] + 21, USB[1] - 8.9, USB[1] + 8.9, B_TOP + 2.5, B_TOP + 4.1) + \
    box(USB[0], USB[0] + 7.5, USB[1] - 4.5, USB[1] + 4.5, USB[2] - 1.6, USB[2] + 1.6)
# the board's parts (R2-S4): footprints from electronics/perfboard.py's own PARTS table and body() (read from its source,
# not run: it plots on import); heights are mechanical's EST: a Dupont housing on a male header, a resistor standing in
# a machined socket, C1's worst-case can (Ø6.4 x 11.5 on its leads), J_BAT's pigtail (it leaves low, toward -y)
def _perfboard():
    import ast
    import pathlib
    tree = ast.parse((pathlib.Path(rt.__file__).resolve().parent.parent / "electronics" / "perfboard.py").read_text())
    keep, seen = [], set()
    for n in tree.body:
        names = {t.id for t in getattr(n, "targets", []) if isinstance(t, ast.Name)} | \
            {e.id for t in getattr(n, "targets", []) if isinstance(t, ast.Tuple) for e in t.elts if isinstance(e, ast.Name)}
        if (isinstance(n, ast.FunctionDef) and n.name in ("xy", "body")) or (names & {"W", "PARTS", "MODULES"} and not names & seen):
            keep.append(n)
            seen |= names
    ns = {}
    exec(compile(ast.Module(body=keep, type_ignores=[]), "perfboard.py", "exec"), ns)
    return ns


PB = _perfboard()
BODY_H = {"J_BAT": 5.0, "J_": 21.5, "socket": 14.0, "C1": 13.5, "C": 7.0, "D": 10.0, "Q2": 8.0, "R": 11.0}   # EST
# (electronics 2026-10-18: a Dupont housing's top 16.5 + its wire's bend up 5; J_BAT's pigtail + glue blob)


def part_h(name):
    if name in ("R_LED", "R_LED_B", "R_PU"):
        return BODY_H["socket"]
    return next(h for k, h in BODY_H.items() if name == k or (k != "socket" and name.startswith(k)))


def part3d(label, a, b):
    bd, h = PB["body"](label, a, b), part_h(label.split()[0])
    if bd[0] == "r":
        return box(B0[0] + bd[1], B0[0] + bd[3], B0[1] + bd[2], B0[1] + bd[4], B_TOP, B_TOP + h)
    return Pos(B0[0] + bd[1], B0[1] + bd[2], B_TOP) * Cylinder(bd[3], h, align=rt.MINB)


parts = {lab.split()[0]: part3d(lab, a, b) for lab, a, b, _ in PB["PARTS"]}
parts3d = sum(list(parts.values())[1:], list(parts.values())[0])
ph_pair = box(JP[0] - PH[1] / 2, JP[0] + PH[1] / 2, JP[1] - PH[0] / 2, JP[1] + PH[0] / 2, 1.2, 1.2 + PH[2])   # J_BAT, mated
emitter = YCYL(BEAM, EM_TIP, BEAM_Z, EM[0], EM[2]) + YCYL(BEAM, EM_FL, BEAM_Z, EM[1], EM[3])
em_legs = box(BEAM - 0.25, BEAM + 0.25, EM_FL + EM[3], EM_FL + EM[3] + 3.0, BEAM_Z - 1.6, BEAM_Z + 1.6) + \
    box(BEAM - 14, BEAM + 0.25, EM_FL + EM[3] + 2.5, EM_FL + EM[3] + 3.0, BEAM_Z - 1.6, BEAM_Z + 1.6)
hdr = box(BAY[3] + 0.85, BAY[3] + 0.8 + HDR[2], HDR_Y - HDR[0] / 2, HDR_Y + HDR[0] / 2, BAY[2], BAY[2] + HDR[1]) + \
    box(BAY[3] - 5.2, BAY[3] + 6.3, HDR_Y - 2.86, HDR_Y + 2.86, BAY[2] + HDR[1] / 2 - 0.32, BAY[2] + HDR[1] / 2 + 0.32)
housing = box(BAY[3] - 14.0, BAY[3] - 0.05, HDR_Y - 3.9, HDR_Y + 3.9, BAY[2] + 0.05, BAY[2] + 2.6)   # 3-pin female, 14 long
pair_bay = box(S0 - 3.0, BAY[3] - 14.0, HDR_Y - 1.7, HDR_Y + 1.7, BAY[2] + 0.5, BAY[2] + 6.0) + \
    box(S0 - 3.0, 50.5, HDR_Y - 1.7, HDR_Y + 1.7, BAY[2] + 2.8, BAY[2] + 6.0) + \
    box(46.5, 50.5, HDR_Y - 1.7, HDR_Y + 1.7, BAY[2] + 2.8, 44.0) + \
    box(46.5, 50.5, HDR_Y, -BLK + RAIL[0], 40.5, 44.0)   # out the plug's front, U-turn ~3 proud (S36), back over it, up, out
antenna = box(*LANT, USB[1] - 8.9, USB[1] + 8.9, B_TOP + 2.5, B_TOP + 4.1)
lis3dh = box(B0[0] + PB["MODULES"]["LIS3DH"][0], B0[0] + PB["MODULES"]["LIS3DH"][2], B0[1] + PB["MODULES"]["LIS3DH"][1],
             B0[1] + PB["MODULES"]["LIS3DH"][3], B_TOP + 2.5, B_TOP + 5.6)   # the SparkFun on its headers (EST)
duct = box(S0 + T + 2, LANE[4] + LANE[5], -3.0, -15.5, 2.0, 28.0)                # the dash's leads run here (S31)
# ... and on to the plugs (R2 antenna): across the XIAO's USB end, then back along the plug row's right side, never over
# its antenna end
lead_way = box(LANE[4] + LANE[5], 132.0, -3.0, -47.0, 32.0, 38.0) + box(126.0, 182.0, -43.0, -47.0, 32.0, 38.0) + \
    box(126.0, 179.0, -3.0, -9.0, 32.0, 38.0) + box(155.0, 179.0, -9.0, -21.0, 32.0, 38.0) + \
    box(178.0, 190.0, -30.0, -47.0, 32.0, 38.0)   # + along the left wall to J_OLED / J_STAT (top edge) and on to J_BZ
in_l = board + xiao + parts3d + lis3dh + ph_pair + emitter + em_legs
dash += box(osb.max.X + 0.2, osb.max.X + 1.4, oy[0] - 0.9, oy[0] + 0.7, osb.min.Z, osb.max.Z)   # the socket's rib (after the bay)
in_dash = module + ol_socket + ol_lead + hdr + housing + buzzer + switch + sw_plate + leds[0] + leds[1]

PRINT = {"sled_R": Rot(90, 0, 0) * part_r, "sled_L": part_l, "sled_lid": Rot(180, 0, 0) * lid,
         "sled_keyplate": Rot(0, 90, 0) * sw_plate, "sled_keycap": Rot(0, -90, 0) * keycap, "sled_drawer": drawer,
         "sled_dash": Rot(0, -90, 0) * dash}
rt.PRINT.update(PRINT)
rt.SLIDING.update({"sled_R": rt.SLIDING["R"], "sled_L": rt.SLIDING["L"]})
PLATES = {"sled_plate1": [("sled_R", 90, 3.0, 3.3), ("cartridge", 0, 226, 206)],
          "sled_plate2": [("sled_L", 12, 10.8, 116.6)],
          "sled_plate3": [("sled_lid", 0, 10, 10), ("sled_drawer", 0, 10, 110)],
          "sled_plate4": [("sled_dash", 0, 20, 20), ("sled_keyplate", 0, 140, 20), ("sled_keycap", 0, 180, 20)]}
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
    n_q, _ = rt.shared_checks(part_l, part_r, cart, lid + dash)   # queue, opening, envelope, roof, rail joint, ball path
    for n, span, lim in (("sled_R", 10.2, 45.0), ("sled_L", 16.0, 60.5), ("sled_lid", 10.2, 45.0), ("sled_keyplate", 10.2, 45.0),
                         ("sled_keycap", 10.2, 45.0), ("sled_drawer", 10.2, 45.0), ("sled_dash", 10.2, 45.0)):
        assert not unbridged(PRINT[n], span, lim), f"{n}: an overhang past 45 deg that isn't an anchored bridge, as it prints"
    # the board: one pin, stops, lips, clips; supports only in the keep-out zones; 14 clear above
    assert nothing(board, part_l) and all(not nothing(Pos(*d) * board, part_l) for d in
                                           ((0.5, 0, 0), (-0.5, 0, 0), (0, 0.5, 0), (0, -0.5, 0), (0, 0, 0.4), (0, 0, -0.1))), \
        "the board isn't located (pin, lane wall, back stop, pads, lips / clips over it)"
    assert not nothing(Pos(*PINS[0], B0[2]) * Cylinder(1.5, BD[2], align=rt.MINB), part_l) and \
        nothing(Pos(*PINS[1], B0[2]) * Cylinder(1.6, 10, align=rt.MINB), part_l), \
        "no locating pin through the header-edge hole, or a pin by the lipped edge (B15)"
    zones = box(B0[0] + 0.5, B0[0] + 4, B0[1], B0[1] + BD[1], 0, 20)
    for y in (0.0, BD[1] - 1.5):
        zones += box(B0[0], B0[0] + BD[0], B0[1] + y, B0[1] + y + 1.5, 0, 20)
    for s, y in PINS:
        zones += Pos(s, y, 0) * Cylinder(3.5, 20, align=rt.MINB)
    under = box(B0[0], B0[0] + BD[0], B0[1], B0[1] + BD[1], B0[2] - 3.5, B0[2])
    assert nothing((part_l & under) - zones, under), "something under the board outside its keep-out zones (B4)"
    above = box(B0[0] + 0.1, B0[0] + BD[0], B0[1] + 1.0, B0[1] + BD[1] - 1.0, B_TOP, B_TOP + 14)
    for s, y in PINS:
        above -= Pos(s, y, 0) * Cylinder(1.6, 100, align=rt.MINB)
    assert nothing(above, part_l + lid) and nothing(Pos(0, 0, 12) * parts3d, lid + part_l) and nothing(parts3d, part_l + lid), \
        "something in the board's 14 keep-out, or < 12 over a part (perfboard.py's, EST heights)"
    assert nothing(ph_pair, part_l) and not nothing(Pos(0, 0, -0.3) * ph_pair, part_l) and \
        not nothing(Pos(0, 1.0, 0) * ph_pair, part_l) and not nothing(Pos(0, -1.0, 0) * ph_pair, part_l) and \
        nothing(box(JP[0] - PH[1] / 2, JP[0] + PH[1] / 2, JP[1] - PH[0] / 2, JP[1] + PH[0] / 2, 1.2 + PH[2], Z1), part_l + in_l - ph_pair), \
        "J_BAT's mated PH pair doesn't lie held in its pocket, reachable from above (lid off)"
    # USB-C: reached through the empty lane, the plug resting on the lane floor, a funnel round the cut-out (S30)
    over = box(S0 - 15, USB[0], USB[1] - 6.5, USB[1] + 6.5, LANE[0] + 0.05, LANE[0] + 8.05)
    assert nothing(over, part_l + in_l - xiao) and abs(USB[2] - (LANE[0] + 4.0)) < 0.05 and \
        abs(USB[1] + 6.5 - (LANE[2] - KEY + 0.3)) <= 0.5, "USB-C: a plug on the lane floor, run along its left wall, can't reach the port"
    assert nothing(box(LANE[4] - 0.01, LANE[4] + 0.5, USB[1] - 7.7, LANE[2] - 0.2, LANE[0], LANE[0] + 9.5), part_l), \
        "no lead-in funnel round the USB-C cut-out (S30)"
    # antenna clear of metal (cells, header pins)
    metal = min(holder.distance_to(antenna), hdr.distance_to(antenna))
    assert metal >= 10, "metal (cells, header pins) < 10 from the antenna"
    fpc = box(*FPC[:4], Z1, Z1 + FPC[4])
    assert nothing(lead_way, part_l + in_l + lid + drawer) and lead_way.distance_to(antenna) >= 10 and \
        nothing(fpc, lid) and not nothing(Pos(0, 0, FPC[4]) * fpc, lid) and FPC[0] - FPC[1] <= -40 and \
        min(x.distance_to(fpc) for x in (holder, hdr, parts3d, xiao)) >= 10, \
        "the dash's leads don't reach the plugs clear of the antenna end, or no FPC antenna spot >= 10 from metal"
    # the drawer: in its lane, keyed, latched, hard stop; slides straight out over the bar, inside the
    # opening at e_L 10 and 15 (1 clear), past the frame (holder at s < 0); holder retained in the tray
    core = drawer - latch_bump
    assert nothing(core, part_l) and nothing(latch_bump, part_l), "the drawer doesn't fit its lane"
    bump = drawer & box(LATCH[0] - 0.5, LATCH[1] + 2.0, DR[3] + 0.01, DR[3] + 1.0, LATCH[2], LATCH[3])   # on the drawer
    assert bump.solids() and nothing(Pos(-CATCH[0] + 0.1, 0, 0) * bump, part_l) and \
        not nothing(Pos(-CATCH[0] - 0.2, 0, 0) * bump, part_l) and not nothing(Pos(0.05, 0, 0) * core, part_l), \
        "the detent doesn't catch the drawer within 0.2 of its stop (B16), or no hard stop behind it"
    assert all(nothing(Pos(-d, 0, 0) * core, part_l + part_r) for d in (2, 10, 30, 60, 90, 125)) and \
        all(in_opening(-y, z, 1.0) for y, z in dr_pts + [((dr_pts[0][0] + dr_pts[1][0]) / 2, (dr_pts[0][1] + dr_pts[1][1]) / 2)]) \
        and DR[5] >= Z_BAR + 1.5 and (DRAWER_OUT * holder).bounding_box().max.X < 0, \
        "the drawer doesn't slide straight out over the bar and through the opening (e_L 10 and 15), clear of the frame"
    flip = Pos(0, DR[3] + DR[4], DR[5] + DR[6]) * Rot(180, 0, 0) * core                # upside down: it can't go in
    assert not nothing(flip, part_l) and KEY - 0.3 >= 1.0, "the drawer isn't keyed (S28 chamfer, >= 1 key fill)"
    assert nothing(holder, drawer) and not nothing(Pos(0, 0, 0.6) * holder, drawer) and \
        nothing(holder, drawer & box(HS[1], DR[2], -200, 0, 0, 100)), "the holder isn't retained in the tray"
    # battery lead (lead 2026-10-18): one length at every pose (it rolls), >= 160; at each step of the way in it stays clear
    # of the drawer (tab excepted where it's glued), L, R, the lid, the dash and the board's parts, above the bar; the
    # U's bend stays forward of the tab; strain relief at both ends (zip-tie slots under it, glue groove); the ~Ø4 joint fits behind the holder
    lens = [lead_len(d) for d in (0, 62.5, 125)]
    fix = part_l + part_r + lid + dash + in_l - ph_pair
    for d in (0, 15, 35, 62.5, 90, 110, 125):
        lt = lead_tube(d)
        fixed, moving, b = lead_pts(d)
        tt = tether_tube(d)
        assert nothing(tt - box(A_S - d - 5, A_S - d + 3, -200, 50, -10, 100) - box(149, 155, -200, 50, -10, 100), fix + Pos(-d, 0, 0) * drawer) and \
            nothing(tt - box(A_S - d - 5, A_S - d + 3, -200, 50, -10, 100), lt), \
            f"the drawer's tether is blocked or touches the lead with the drawer out {d}"
        free = lt - box(J_BAT[0] - 4, J_BAT[0] + 4, J_BAT[1] - 2, J_BAT[1] + 3, J_BAT[2] - 4, J_BAT[2] + 4) - \
            box(A_S - d - 8, A_S - d + 3, DR[4] + 1.4, 0, 0, 100)                     # its ends: the plug, the joint
        assert nothing(free, fix) and nothing(free, Pos(-d, 0, 0) * (drawer + holder)) and \
            (d < 40 or (lt & box(-200, S0, -200, 50, -10, 100)).bounding_box().min.Z >= Z_BAR) and \
            b <= A_S - d - 1.0, \
            f"the battery lead is pinched / blocked with the drawer out {d}"
    t_len = [tether_len(d) for d in (0, 35, 62.5, 90, 110, 120, 125)]
    taut = _plen([E1, *_tab(125.0)])                                   # straight: no stored slack left at 125
    assert max(t_len) - min(t_len) < 0.3 and abs(t_len[-1] - taut) < 0.05 and tether_pts(125.0)[0][1][0] > 149.9 and \
        lead_slack(125.0) >= 10 and (LEAD[2] - LEAD[1]) / 2 >= LEAD_R_MIN - 1e-6 and \
        nothing(Pos(A_S - 3.0, TETHER[1], LEAD[2]) * box(-0.5, 0.5, -0.4, 0.4, -0.4, 0.4), drawer) and \
        all(nothing(Pos(s_, TETHER[1], LEAD[1] - 2.0) * box(-0.5, 0.5, -0.5, 0.5, -0.5, 0.5), part_l) for s_ in (150.0, 154.0)), \
        f"the cord isn't taut at 125 (cut {CORD_L:.1f}) with the lead >= 10 slack ({lead_slack(125.0):.1f}), the bend is < r_min, " \
        "or no tether holes"
    assert max(lens) - min(lens) < 0.5 and min(lens) >= 160 and \
        all(nothing(box(158.0, 161.0, y - 0.7, y + 0.7, LEAD[1] - 2.5, LEAD[1] - 1.5), part_l) and
            not nothing(box(155.0, 157.0, y - 0.7, y + 0.7, LEAD[1] - 2.5, LEAD[1] - 1.5), part_l) for y in (LEAD[3] + 2.6, LEAD[3] - 2.6)) and \
        nothing(box(A_S - 1, A_S + 1, LEAD[3] + 3.8, LEAD[3] + 5.2, LEAD[2] - 1, LEAD[2] + 0.5), drawer) and \
        not nothing(box(A_S - 1, A_S + 1, LEAD[3] + 3.8, LEAD[3] + 5.2, LEAD[2] - 2.6, LEAD[2] - 1.8), drawer) and \
        nothing(box(HS[1] + 0.8, HS[1] + 5.2, -65.2, -60.8, DR[5] + 1.4, DR[5] + 5.8) + fuse, drawer + holder) and \
        HOLDER_LEAD >= (Vector(*lead_pts(0)[1][-1]) - Vector(HS[1], (HY[0] + HY[1]) / 2, H_TOP + 20)).length + 5, \
        f"the battery lead: length {min(lens):.0f}-{max(lens):.0f}, no strain relief at J_BAT (zip-tie slots) / the tab " \
        "(glue groove), or the holder's own lead can't lift it 20 clear of the tray"
    assert nothing(box(DR[0] - 1, DR[0] + 7.9, -35.1, -52.9, 13.6, 23.4), drawer) and \
        nothing(box(DR[0] + 2.1, DR[0] + 7.9, -35.1, -52.9, 23.4, 29.4), drawer) and \
        not nothing(box(DR[0], DR[0] + 1.9, -36.0, -52.0, 26.0, 29.0), drawer) and \
        all(in_opening(-y, z, 3.0) for y in (-35.0, -53.0) for z in (13.5, 23.5)), \
        "no finger pocket (18 x 10 x 8, a lip to hook) low on the drawer front, inside the opening (S29)"
    assert not nothing(box(DR[0] - 0.6, DR[0], -57.0, -68.6, 16.0, 21.0), drawer), "no battery glyph beside the pocket"
    # the dash: sits on L (left wall corbel, lane wall), snaps in, holds its parts; it and the lid clear the drawer
    assert nothing(dash, part_l) and nothing(dash, lid) and nothing(dash, drawer) and nothing(lid, drawer) and \
        not nothing(Pos(0, 0, -0.3) * dash, part_l) and nothing(in_dash, dash) and nothing(in_dash, part_l + drawer), \
        "the dash or its parts collide with L, the lid or the drawer, or it doesn't sit on L"
    snaps = box(36, 46, -0.5, -T - C + 0.05, 40, 46) + box(36, 46, YR + C - 0.05, YR - 0.5, 40, 46)
    sb = dash & snaps
    assert len(sb.solids()) >= 2 and not nothing(Pos(0, 0, 1.0) * sb, part_l), "the dash's snap bumps don't catch in L's windows"
    # OLED: active area inside the opening at e_L 10 and 15, seen straight on and from +-20 deg sideways through its window
    # (the frame's 35-deep tube is the gate's); held in its pocket by the lips; R's pair clear of it
    ab = active.bounding_box()
    los = [box(S0 - 40, ab.min.X, ay[0] + 0.3, ay[1] - 0.3, az[0] + 0.3, az[1] - 0.3)]
    for k in (-1, 1):             # +-20 deg in plan, from the window's far edges
        t = math.tan(math.radians(20))
        los.append(prism([(ab.min.X, ay[0] + 0.3), (ab.min.X, ay[1] - 0.3), (ab.min.X - 6, ay[1] - 0.3 + k * 6 * t),
                          (ab.min.X - 6, ay[0] + 0.3 + k * 6 * t)], az[0] + 0.3, az[1] - 0.3))
    assert all(in_opening(-y, z, 3.0) for y in ay for z in az) and all(nothing(l_, dash + part_l) for l_ in los), \
        "the OLED's active area isn't inside the opening / seen straight on and at +-20 deg through its window"
    assert nothing(module, dash) and not nothing(Pos(0.6, 0, 0) * module, dash) and not nothing(Pos(-0.3, 0, 0) * module, dash) \
        and all(nothing(Pos(0, 0, dz) * module, dash) for dz in (3, 8, 15, 30)), \
        "the OLED module doesn't drop into its slot from the top, or isn't held there (window in front, rails behind)"
    assert all(nothing(Pos(0, 0, dz) * (module + ol_socket), dash) for dz in (0, 3, 8, 15, 30)) and \
        not nothing(box(osb.max.X + 0.3, osb.max.X + 1.3, oy[0] + 0.25, oy[0] + 0.65, osb.min.Z + 1, osb.max.Z - 1), dash) and \
        nothing(ol_lead, dash + part_l + lid + module) and \
        ol_lead.bounding_box().max.X >= 59.9 and ol_lead.bounding_box().max.Z >= TOP - 6.2, \
        "the OLED's unused PH2.0 socket doesn't drop in with it onto its rib, or its 4 wires don't reach the channel (R2-B2)"
    assert nothing(pair_bay, dash + housing + module + part_l) and pair_bay.distance_to(module) >= 1.5 and \
        (pair_bay & box(ds + T + OL[2] + 5, 100, -100, 0, 0, 100)).distance_to(module) >= 5 and \
        pair_bay.bounding_box().min.Z > LANE[1] and pair_bay.bounding_box().min.X >= S0 - 3.5 and \
        pair_bay.bounding_box().max.Y < ay[0] and housing.bounding_box().min.X <= S0 + 1.05, \
        "R's plug isn't <= 1 behind the face, or its pair can't U-turn (<= 3.5 proud, above the drawer, right of the OLED, "\
        ">= 5 behind its back)"
    # status LEDs: seated on their steps, face 0.5 behind the dash front, seen straight on and at +-20 deg, inside the
    # opening, under the OLED window and 6 apart; their channels open above (they drop in from behind the OLED)
    for (y, z), led in zip(LEDS, leds):
        t = math.tan(math.radians(20))
        sights = [XL(y, z, S0 - 30, ds + LED[0] - 0.01, 1.3)] + \
            [prism([(ds + LED[0] - 0.01, y - 1.2), (ds + LED[0] - 0.01, y + 1.2), (ds - 2, y + 1.2 + k * (LED[0] + 2) * t),
                    (ds - 2, y - 1.2 + k * (LED[0] + 2) * t)], z - 1.0, z + 1.0) for k in (-1, 1)]
        assert nothing(led, dash) and not nothing(Pos(-0.3, 0, 0) * led, dash) and \
            all(nothing(l_, dash + part_l) for l_ in sights) and in_opening(-y, z, 3.0) and z + 1.9 < az[0] - 0.5 and \
            nothing(box(ds + LED[0] + LED[1] + 1.5, 51.0, y - 1.8, y + 1.8, z + 2.0, OZ + 1.0), dash) and \
        51.0 - (ds + LED[0]) >= LED[1] + LED[2] + 3.0, \
            "a status LED isn't seated / seen straight on and at +-20 deg / under the OLED / droppable into its channel"
    assert abs(abs(LEDS[0][0] - LEDS[1][0]) - 6.0) < 1e-6, "the status LEDs aren't 6 apart"
    # undo key: the plate (switch clipped in) slides up from below into its slot; the cap presses onto the stem through
    # the face, its face 1 behind it, and then locks them; pressed 4 it clears the switch and the dash; inside the opening
    assert nothing(sw_plate, dash) and nothing(switch, dash + sw_plate) and nothing(keycap, dash + switch_body) and \
        all(nothing(Pos(0, 0, -dz) * (sw_plate + switch), dash) for dz in (3, 8, 15, 30)) and \
        not nothing(Pos(0, 0, -1.0) * (sw_plate + switch + keycap), dash) and \
        nothing(Pos(MX[7], 0, 0) * keycap, dash + switch_body) and abs(kc0 - S0) < 1e-6 and \
        MX[0] < 14.05 and abs(MX[1] - 1.5) < 1e-6, \
        "the MX key doesn't go in from below / lock with its cap / travel 4 clear / sit flush with the face"
    assert all(in_opening(-(BTN[0] + a * KC[0] / 2), BTN[1] + b * KC[0] / 2, 2.0) for a in (-1, 1) for b in (-1, 1)), \
        "the undo key's cap isn't >= 2 inside the opening"
    # bay: header held (row ~1.3 over its floor), plug + bay open from the front and above, inside the opening
    assert nothing(hdr, dash) and not nothing(Pos(-0.6, 0, 0) * hdr, dash) and not nothing(Pos(0.6, 0, 0) * hdr, dash) and \
        nothing(housing, dash + part_l + lid) and \
        nothing(box(S0 - 5, BAY[3] - 0.1, BAY[0] - 0.1, BAY[1] + 0.1, BAY[2] + 0.1, OZ - 1.3), dash + part_l + lid) and \
        nothing(box(ds + T + OL[2] + 1.8, BAY[3] - 0.1, BAY[0] - 0.1, BAY[1] + 0.7, BAY[2] + 0.1, TOP + 5), dash + part_l + lid) and \
        all(in_opening(-y, BAY[2] + 3, 3.0) for y in BAY[:2]), "the receiver bay / its header / plug aren't reachable at the mouth"
    # service grip: open through the lane's right wall into the space under the rail (>= 5.5 deep for a fingertip), a
    # front edge to pull on and a top edge to lift by, both L's own; inside the opening; the drawer slides past it
    grip = box(PULL[0] + 0.5, PULL[1] - 0.5, LANE[3] - 0.01, LANE[3] - 5.5, PULL[2] + 0.5, PULL[3] - 0.5)
    assert nothing(grip, part_l) and not nothing(box(PULL[0] - 2, PULL[0], LANE[3], LANE[3] - 1.2, PULL[2] + 1, PULL[3] - 1), part_l) \
        and not nothing(box(PULL[0] + 1, PULL[1] - 1, LANE[3], LANE[3] - 1.2, PULL[3], PULL[3] + 2), part_l) and \
        all(in_opening(-LANE[3], z, 3.0) for z in PULL[2:]) and nothing(grip, drawer), \
        "no service grip in the lane's right wall (a finger pulls / lifts L by it, drawer out)"
    # buzzer: in its sleeve, port <= 2 under the grille, >= 15 from the LIS3DH, >= 10 from the antenna; leads in the duct
    assert nothing(buzzer, dash) and not nothing(Pos(0, 0, -1.6) * buzzer, dash) and \
        nothing(Pos(BUZ[0], BUZ[1], BZ0 + 9.0) * Cylinder(4.0, TOP + 1 - BZ0 - 9.0, align=rt.MINB), dash + lid) and \
        BZ0 + 9.0 > OZ - 0.2 and buzzer.distance_to(lis3dh) >= 15 and \
        buzzer.distance_to(antenna) >= 10 and switch.distance_to(antenna) >= 10, \
        "the buzzer's sleeve / open port / distances (LIS3DH 15, antenna 10) are wrong"
    assert nothing(duct, part_l + drawer + in_l) and nothing(box(SP[0] + 3, SP[0] + 8, BTN[0] + 6.9, BTN[0] + 3.9, DASH[2] - 1, DASH[2] + 3), dash) \
        and BTN[0] + 3.9 > LANE[2] + 1.2 and nothing(box(60.2, 61.5, BTN[0] + 7.0, HDR_Y, TOP - 5.8, TOP - 4.5), dash), \
        "the dash's leads have no channel to the hidden strip (S31) or no way down into it"
    # the lid: covers the box, sits on its corbels, held by its rear lips and the front tab; the dash lifts off past the
    # tab, then the lid comes off front up 2 deg about its lips, forward, up
    assert nothing(lid, part_l) and nothing(lid, part_r) and nothing(lid, dash) and not nothing(Pos(0, 0, -0.3) * lid, part_l), \
        "the lid hits L / R, or doesn't sit on its supports"
    tab = box(de - 1, de + 2, *TABW, 0, 100) & lid
    assert not nothing(Pos(0, 0, 0.5) * tab, dash) and not nothing(Pos(0, 0, 0.5) * (lid - tab), part_l), \
        "the lid isn't held: its front tab or rear lips don't catch"
    pv = (199.0, 0, Z1 - 1.8)
    tilt = Pos(*pv) * Rot(0, 2, 0) * Pos(-pv[0], 0, -pv[2])
    assert all(nothing(m * (lid - tab), part_l + in_l) for m in
               (tilt, Pos(-0.75, 0, 0) * tilt, Pos(-1.5, 0, 0) * tilt, Pos(-1.5, 0, 10) * tilt)), \
        "the lid can't come off (dash off): front up 2 deg, forward out of the lips, up"
    # R's receiver pair: in the bridge's rebate, climbs clear of a 36 ball, drops into the bay over L's notch
    ball = Pos(RB[0] - 1, -W + rt.SKIN + 18 + 0.3, 18) * rt.Sphere(18)
    assert nothing(pair_bridge, part_r) and nothing(pair_climb, part_r) and ball.distance_to(pair_climb) >= 2 and \
        nothing(pair_bridge + pair_climb, part_l + dash) and \
        nothing(box(RB[0] + 0.1, RB[0] + 3.3, YR - 0.5, -BLK + RAIL[0], 40.5, 44.0), part_l), \
        "R's receiver pair doesn't fit the bridge's rebate / climb clear of the balls / reach the bay"
    # emitter: drops into its trough, the flange slot holds it, the Ø3 tube is clear, 12 behind the aperture
    assert all(nothing(Pos(0, 0, dz) * (emitter + em_legs), part_l) for dz in (0, 3, 8, 15, 30)) and \
        all(not nothing(Pos(0, d, 0) * emitter, part_l) for d in (0.6, -0.6)), "the emitter doesn't drop in / sit in its slot"
    assert nothing(YCYL(BEAM, -BLK - 1, BEAM_Z, 1.3, EM[4] + 1), part_l) and abs(EM_TIP + BLK - 12.0) < 1e-6, \
        "the emitter's tip isn't 12 behind a clear Ø3 aperture"
    for plate in PLATES:
        rt.check_plate(plate)
    for name, deg in {(n, d) for pl in PLATES.values() for n, d, *_ in pl if n in rt.SLIDING}:
        assert rt.back_seams(name, deg) == 0, f"{name} turned {deg} deg: seam 'Back' lands on a groove / tongue face"
    fl = part_l & box(-1e3, 1e3, -1e3, 1e3, 0, 0.2)
    assert fl.area / 2 >= 0.6 * ((rt.S_END - S0) * BLK) * 0.5, "L: first layer is thin rails only (it lifts)"
    assert all(p.is_valid for p in (part_l, part_r, lid, dash, drawer))
    vol = sum(p.volume for p in (part_l, part_r, cart, lid, dash, drawer, sw_plate, keycap)) / 1000
    ar = (ay[1], ay[0])
    print(f"sled: L {part_l.bounding_box().size.X:.0f} x {BLK:.0f} x {TOP:.0f} (flat top); drawer r {-DR[3]:.1f}-{-DR[4]:.1f} "
          f"z {DR[5]:.0f}-{DR[6]:.0f}, out to s {(DRAWER_OUT * holder).bounding_box().max.X:.0f} on a {LEAD_LEN:.0f} lead; OLED active r "
          f"{-ar[0]:.1f}-{-ar[1]:.1f} z {ab.min.Z:.1f}-{ab.max.Z:.1f} (0.91\" upright); all inside the opening at e_L "
          f"{E_L[0]:.0f}-{E_L[1]:.0f}; {n_q} balls queue clear of the beam; antenna {metal:.0f} from metal; "
          f"~{vol * 1.27:.0f} g PETG solid ({vol:.0f} cm3)")


if __name__ == "__main__":
    self_check()
    if "--check" in sys.argv:
        sys.exit()
    rt.OUT.mkdir(exist_ok=True)
    out = rt.OUT
    COL = {"sled_R": "#5e81ac", "cartridge": "#3b4252", "sled_L": "#88c0d0", "sled_lid": "#a3c9d6", "sled_keyplate": "#4c566a",
           "sled_keycap": "#d08770", "sled_drawer": "#ebcb8b", "sled_dash": "#81a1c1"}
    bed = box(0, rt.BED, 0, rt.BED, -0.6, -0.3)
    for plate in PLATES:
        placed = rt.check_plate(plate)
        m = Mesher()
        for _, p in placed:
            m.add_shape(p)
        m.write(str(out / f"{plate}.3mf"))
        render(out / f"{plate}.png", [(bed, "#c8c8c8", 1)] + [(p, COL[n], 1) for n, p in placed], view=(0, 0, 1), up=(0, 1, 0),
               size=(900, 900), title=f"{plate}: 256 x 256 bed, supports off")
    for name, p in (("sled_l", part_l), ("sled_r", part_r), ("sled_lid", lid), ("sled_keyplate", sw_plate), ("sled_keycap", keycap),
                    ("sled_cartridge", cart), ("sled_drawer", drawer), ("sled_dash", dash)):
        export_stl(p, str(out / f"{name}.stl"))
    elec = [(board, "#2e7d32", 1), (xiao + lis3dh, "#37474f", 1), (parts3d + ph_pair, "#222222", 1), (emitter + em_legs, "#bf616a", 1)]
    dparts = [(module, "#111111", 1), (active, "#e5e9f0", 1), (hdr + housing, "#ebcb8b", 1), (pair_bay, "#a3be8c", 1), (leds[0], "#a3be8c", 1), (leds[1], "#bf616a", 1), (buzzer, "#222222", 1),
              (sw_plate, "#4c566a", 1), (switch, "#5e81ac", 1), (keycap, "#d08770", 1)]
    drw = [(drawer, "#ebcb8b", 1), (holder, "#424242", 1)]
    view = (-0.55, 0.45, 0.8)
    render(out / "sled_l_open.png", [(part_l, "#88c0d0", 1)] + elec + drw, view=view, size=(1400, 900),
           title="L, lid and dash off: the drawer lane + drawer, the board behind it, the emitter at the beam")
    render(out / "sled_l_closed.png", [(part_l, "#88c0d0", 1), (lid, "#a3c9d6", 1), (dash, "#81a1c1", 1)] + dparts + drw,
           view=view, size=(1400, 900), title="L assembled: flat lid, the dash (button, 0.91\" OLED, bay under it) over the battery drawer")
    render(out / "sled_drawer_out.png", [(part_l, "#88c0d0", 1), (lid, "#a3c9d6", 1), (dash, "#81a1c1", 1)] + dparts +
           [(DRAWER_OUT * drawer, "#ebcb8b", 1), (DRAWER_OUT * holder, "#424242", 1), (lead_out, "#bf616a", 1),
            (tether_tube(125.0), "#eceff4", 1)],
           view=(-0.7, 0.3, 0.6), size=(1500, 900),
           title="Battery swap with the sled in place: the drawer pulled out through the frame, the holder clear, its lead rolled out")
    render(out / "sled_l_top.png", [(part_l, "#88c0d0", 1)] + elec + drw, view=(0, 0, 1), up=(0, 1, 0), size=(1500, 650),
           title="L from above, lid and dash off (front left): drawer, board behind it, emitter")
    frame = box(0, 35, 40, -175, -5, 80)
    hole = box(-1, 36, -E_L[1] - 10, -E_L[1] - rt.OPEN[0] + 10, Z_BAR, Z_BAR + rt.OPEN[1]) + \
        box(-1, 36, -E_L[1], -E_L[1] - rt.OPEN[0], Z_BAR + 10, Z_BAR + rt.OPEN[1] - 10)
    for cy in (-E_L[1] - 10, -E_L[1] - rt.OPEN[0] + 10):
        for cz in (Z_BAR + 10, Z_BAR + rt.OPEN[1] - 10):
            hole += Pos(-1, cy, cz) * Rot(0, 90, 0) * Cylinder(10, 37, align=rt.MINB)
    frame -= hole
    scene = [(part_l, "#88c0d0", 1), (lid, "#a3c9d6", 1), (dash, "#81a1c1", 1), (part_r, "#5e81ac", 1)] + dparts + drw
    render(out / "sled_front.png", scene, view=(-1, 0, 0), up=(0, 0, 1), size=(1300, 700),
           title=f"Front face (no frame): drawer + pocket + glyph, dash: undo button, OLED, bay")
    for name, v in (("sled_eye_0", (-1, 0, 0.18)), ("sled_eye_left20", (-0.94, 0.34, 0.18)), ("sled_eye_right20", (-0.94, -0.34, 0.18))):
        render(out / f"{name}.png", [(frame, "#2e3440", 1)] + scene, view=v, up=(0, 0, 1), size=(1300, 750),
               title=f"Through the frame at e_L {E_L[1]:.0f} (worst), eye {name.split('_')[-1]}: OLED, button, drawer, bay")
    up_ = lambda dz, p: Pos(0, 0, dz) * p   # noqa: E731
    ex = [(part_l, "#88c0d0", 1), (up_(90, lid), "#a3c9d6", 1), (up_(45, dash), "#81a1c1", 1),
          (up_(45, module + active), "#111111", 1), (up_(45, buzzer + hdr), "#222222", 1),
          (Pos(0, 0, 25) * (sw_plate + switch), "#4c566a", 1), (Pos(-30, 0, 45) * keycap, "#d08770", 1),
          (Pos(-90, 0, 0) * drawer, "#ebcb8b", 1), (Pos(-90, 0, 25) * holder, "#424242", 1),
          (up_(25, board + xiao + parts3d + lis3dh), "#2e7d32", 1), (up_(30, emitter + em_legs), "#bf616a", 1),
          (Pos(0, -60, 0) * part_r, "#5e81ac", 1), (Pos(0, -95, 0) * cart, "#3b4252", 1)]
    render(out / "sled_exploded.png", ex, view=(-0.6, 0.55, 0.65), size=(1500, 1000),
           title="Sled exploded: lid + dash lift off, the drawer slides out the front; R + its cartridge (right)")
    render(out / "sled_l_print.png", [(PRINT["sled_L"], "#88c0d0", 1)], view=(-0.6, 0.5, 0.7), size=(1300, 850),
           title="L as it prints (upright, supports off): every overhang <= 45 deg or an anchored bridge (<= 16)")
    render(out / "sled_dash_print.png", [(PRINT["sled_dash"], "#81a1c1", 1), (Pos(0, 90, 0) * PRINT["sled_drawer"], "#ebcb8b", 1)],
           view=(-0.5, -0.6, 0.8), size=(1300, 850), title="Dash (on its front face) and drawer (on its floor) as they print")
    tunnel = box(0, rt.TUNNEL[2], -W, rt.GAP, -3, 0) + box(0, rt.TUNNEL[2], rt.GAP, rt.GAP + 3, -3, rt.TUNNEL[1]) + \
        box(0, rt.TUNNEL[2], -W - 3, -W, -3, rt.TUNNEL[1])
    render(out / "sled.png", [(tunnel, "#e8dcc8", 0.35), (part_l + lid + dash, "#88c0d0", 1), (drawer, "#ebcb8b", 1),
                              (part_r + cart, "#5e81ac", 1)], view=(-0.35, 0.55, 0.75),
           title="The goal-counter sled in the tunnel: L (light) with dash, lid and drawer; R (dark)")
    print("exported: out/sled_plate1-4.3mf, out/sled_*.stl, renders out/sled*.png (incl. sled_drawer_out, sled_eye_*)")
