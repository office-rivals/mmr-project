"""Roll-test print of the goal-counter sled (drawer-v4-concept.md): the ball path only, built to go in through the frame.

    uv run python roll_test.py          # self-check, then out/roll_test_plate1/2.3mf + STLs + renders
    uv run python roll_test.py --check  # self-check only

No electronics, no hatch: the V-wall, the channel along the RIGHT wall, the receiver pod with its lead-in at the beam,
and the queue zone. The tunnel is wider than the black frame's opening (~130 x 55, R 10), so the piece comes in as two
parts that each pass the opening and join inside:
  L (left, one print): the channel's left face with a dovetail RAIL on top, the V-wall under a sloped roof, and slide
    ribs on its left face that take up the tunnel's spare width (fit 1: ~4.5 mm; the ribs leave ~2.5).
  R (right, one print, the keeper): the right skin, the pod + lead-in with the receiver cartridge, and three bridges
    whose dovetail tongues ride in L's rail, so R can't lift out of it.
L goes in first; R slides in along it, its tongues picking up the rail at the mouth (where you can see it). Out: R
first, then L. Procedure: ROLL-TEST.md. Fit 1 (DECISIONS 2026-10-16): L 80 shorter (its tip ends before the block's
end at ~285), no wiper, a taller V-wall/roof, a captive rail, stiffer bridges; so the beam moved 240 -> 194 (45 deg V-wall).
Frame: x = s, into the tunnel from the frame's outer face; y = -r from L's left edge, so the RIGHT wall (seen from the
opening) is at y = -W and the left wall at y = +GAP; z up from the tunnel floor.
"""
import math
import sys
from pathlib import Path

import matplotlib
from build123d import (Align, Box, Cylinder, Mesher, Plane, Polygon, Pos, Rot, Sphere, Text, export_stl, extrude, loft,
                       section)
from render import render

# ---- tunnel + frame (drawer-v4-concept.md) and the design under test -------------------------------------------
W = 135.0                        # right wall to L's left wall (the ribs add RIB)
SPARE, RIB = 4.5, 2.0            # tunnel width - W (fit 1, EST: user saw ~4-5 spare), L's slide ribs (lead: float <= ~2.5)
TUNNEL = (W + SPARE, 50.0, 490.0)    # interior width (EST from fit 1), height (drawn only: user, the mouth is the limit), length
OPEN = (130.0, 57.0, 10.0, 10.0)  # frame opening width, height (user 2026-10-18: 57; was ~55), corner radius; the wooden tunnel
                                 # floor is ~10 BELOW the frame's bottom bar (user 2026-10-16)
MOUTH_CLEAR = OPEN[1]            # a unit slides in over the bar, then drops onto the tunnel floor: the opening is the limit
CLR_TOP = 3.0                    # margin under it (lead: L = 52)
GAP = SPARE - RIB                # float left between the ribs and the left wall
S0 = 36.0                        # front face, s from the frame's outer face (frame tube ~35 deep)
BEAM, VDEG, LEAD = 194.0, 45.0, 8.0    # beam position, V-wall angle (lead: 45 deg, so 4 x 36 queue from the bar and L
                                       # still ends at ~276), pod lead-in
L_MAX = 276.5                    # L's tip (fit 1: 80 shorter than 356; the block's end / the angled board is at ~285)
GATE, POD, POD_L = 40.0, 12.0, 28.0    # gate between the block face and the pod; pod thickness, length
BALL = (31.0, 36.0)
Q0, N_MIN = 33.0, 4               # first waiting ball's front: against the frame's bottom bar (EST: ~35 deep); balls that
                                  # must queue clear of the beam (firmware)
T, SKIN = 1.2, 1.6               # wall, right skin thickness
H_WALL, H_TOP, BR = 30.0, 43.0, 3.0    # wall height, bridge/strap top (<= 44), bridge plate over the rail
Z_BR = BALL[1] + 2               # bridges over the channel reach down to here (stiffer: fit 1), the balls pass under
BRIDGE_H = (8.0, 8.0, 11.0)      # half-widths of the front, mid bridge and the strap (front/mid were 5)
ROOF_Z, V_MIN = 52.0, BALL[1] + 1   # roof at L's left wall (roll test v2 as printed, for a ~55 opening; the 57 allows 54) falling
                                                     # to the V-wall's top (>= a ball)
RAIL = (10.0, 6.0, 0.35)         # rail width on the block face, its height, dovetail clearance per side (both mating
                                 # faces print as 45 deg overhangs: FDM-rough, user)
DOVE = (2.0, 1.5, 6.0, 2.0, 4.0, 30.0)   # tongue, from the rail's -y edge (r): slope root, neck height, neck's +y face,
                                 # hook overlap, depth, hook face from horizontal. Hooked on the +y side only: as R prints
                                 # on its skin the -y side faces down, so it's a 45 deg slope (coupon 1: a -y foot strung).
                                 # The hook is flatter than 45 deg (L's lip: 60 from vertical, Bambu's default no-support
                                 # limit): at 45 it was parallel to the slope and R slid out along both (coupon 2)
CLR_OPEN = 3.0                   # margin per side through the opening
FLOOR_L = 0.4                    # L's floor skin: its walls alone give only 1.2 mm rails on the bed, which lift (user's print)
BEAM_Z = 17.0                    # beam axis above the floor (electronics/dimensions.md: 31-36 balls, usable ~14-20)
RX = (3.0, 3.9, 0.6, 3.5, 4.4, 3.2)   # TEFT4300: body Ø, flange Ø, flange t, flange top -> tip, tip behind the aperture (4.4: review 2 R1.6, less daylight); body bore
PTFE = (25.4, 0.15)              # PTFE tape on the skin: width, recess depth (the tape's edge can't catch a ball)
CH = (5.5, 4.4, 3.5, 3.4)        # receiver lead channel on top of the skin: width, height, groove width, groove depth
                                 # (electronics: 2 x Ø1.6 stacked, 26 AWG fallback jumpers)

# ---- derived -----------------------------------------------------------------------------------------------------
BLK = W - SKIN - POD - GATE      # L's width: its straight face is the channel's left side
S_END = BEAM + BLK / math.tan(math.radians(VDEG))      # V-wall meets L's left edge
S_TIP = BEAM + POD_L / 2 + POD / math.tan(math.radians(LEAD))   # lead-in tip on the right skin
R0 = S0 + 8.0                    # R's front end (R is S_TIP - R0 long, one print: <= 250)
Y_POD = -W + SKIN + POD          # pod face (y)
Y_RAIL = -BLK + RAIL[0] / 2      # groove / tongue centre line
RAIL_Z = H_TOP - BR              # rail top = bridge plate's underside
MOUTH = (14.0, 4.5)               # lead-in at L's rail front: length, half-width at the front (tapers to the groove)
S_PEGS = (S0 + MOUTH[0] + 10.0, (R0 + BEAM) / 2, BEAM)   # front bridge (its tongue starts 2 past the open funnel, past
                                  # the 1 lead-in: at R0 + 8 half of it rode in the funnel, roll test v2), mid bridge, strap
ROOF_SLOPE = math.atan((ROOF_Z - V_MIN) / BLK)        # the V-wall is lowest at the gate, where the roof is BLK wide
OUT = Path(__file__).parent / "out"
MINB = (Align.CENTER, Align.CENTER, Align.MIN)


def box(x0, x1, y0, y1, z0, z1):    # corners in any order
    (x0, x1), (y0, y1), (z0, z1) = sorted((x0, x1)), sorted((y0, y1)), sorted((z0, z1))
    return Pos(x0, y0, z0) * Box(x1 - x0, y1 - y0, z1 - z0, align=(Align.MIN,) * 3)


def prism(pts, z0, z1):           # XY polygon extruded z0..z1 (either winding)
    if sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1])) < 0:
        pts = pts[::-1]
    return Pos(0, 0, z0) * extrude(Polygon(*pts, align=None), z1 - z0)


def yz_prism(pts, s0, s1):        # YZ polygon (y, z) extruded along s from s0 to s1
    return Pos(s0, 0, 0) * extrude(Plane.YZ * Polygon(*pts, align=None), s1 - s0, dir=(1, 0, 0))   # explicit dir: winding-proof


def r_v(s):                       # V-wall line: distance from L's left edge (r) at s
    return BLK * (S_END - s) / (S_END - BEAM)


def wall_on(p0, p1, t, z0, z1, side=1):   # a wall of thickness t whose face is the line p0 -> p1, offset to one side
    d = (p1[0] - p0[0], p1[1] - p0[1])
    n = (-d[1] / math.hypot(*d) * t * side, d[0] / math.hypot(*d) * t * side)
    return prism([p0, p1, (p1[0] + n[0], p1[1] + n[1]), (p0[0] + n[0], p0[1] + n[1])], z0, z1)


def dove_pts(c, z_top):           # tongue profile (clearance c added per side, across s) hanging from z_top
    r0, h, rn, w, d, hook = DOVE
    y, z_h = lambda r: -BLK + r, z_top - h - w * math.tan(math.radians(hook))
    return [(y(r0 - 0.5) - c, z_top + 0.5), (y(r0 + d), z_top - d - c), (y(rn + w) + c, z_top - d - c),
            (y(rn + w) + c, z_h), (y(rn) + c, z_top - h), (y(rn) + c, z_top + 0.5)]


def dovetail(c, s0, s1, z_top):
    return yz_prism(dove_pts(c, z_top), s0, s1)


LEAD_IN = 1.0                    # 45 deg lead-in at each end of a tongue / rail section (coupon 3: a seam bump stopped it)


def yz_face(c, s, z_top):
    return Pos(s, 0, 0) * (Plane.YZ * Polygon(*dove_pts(c, z_top), align=None))


def lead_in(c, s, inward, z_top):  # groove cut: the profile grown by LEAD_IN at s, back to c at s + inward * LEAD_IN
    return loft([yz_face(c + LEAD_IN, s, z_top), yz_face(c, s + inward * LEAD_IN, z_top)]) + \
        dovetail(c + LEAD_IN, min(s, s - inward), max(s, s - inward), z_top)      # + 1 beyond the end


def tongue(s0, s1, z_top):        # R's tongue, both ends shrunk by LEAD_IN
    a, b = s0 + LEAD_IN, s1 - LEAD_IN
    return loft([yz_face(-LEAD_IN, s0, z_top), yz_face(0.0, a, z_top)]) + dovetail(0.0, a, b, z_top) + \
        loft([yz_face(0.0, b, z_top), yz_face(-LEAD_IN, s1, z_top)])


below_roof = Pos(0, 0, ROOF_Z) * Rot(math.degrees(ROOF_SLOPE), 0, 0) * box(-1000, 1000, -300, 50, -300, 0)
# ---- L: left wall up to the roof plane, block face with the rail, cross walls, V-wall under the roof, and a separate
# LID in the roof's plane over the box in front of it (user's markup: no ball onto L's top / the components)
T_LID = 1.6
under_lid = Pos(0, 0, -T_LID) * below_roof


def l_shell(inner):               # L's walls, rail, V-wall + roof, floor skin, slide ribs and groove; inner = what's in its box
    p = box(S0, S_END, -T, 0, 0, 100) & below_roof
    p += box(S0, BEAM, -BLK, -BLK + T, 0, RAIL_Z)                                   # channel's left face, up to the rail
    p += box(S0, BEAM + 3, -BLK, -BLK + RAIL[0], RAIL_Z - RAIL[1], RAIL_Z)          # rail
    p += yz_prism([(-BLK + T, RAIL_Z - RAIL[1] - (RAIL[0] - T)), (-BLK + T, RAIL_Z - RAIL[1]), (-BLK + RAIL[0], RAIL_Z - RAIL[1])],
                  S0, BEAM + 3)                                                     # 45 deg chamfer under the rail
    p += box(S0, S0 + T, -BLK, 0, 0, 100) & below_roof                             # front wall, up to the roof plane
    # V-wall: its ball face on the line (BEAM, -BLK) -> (S_END, 0), full height up to the roof (>= V_MIN, a ball can't get
    # over it), and the roof over everything behind it, falling toward the channel (fit 1: balls got on top)
    vwall = wall_on((BEAM, -BLK), (S_END, 0), T, 0, 100) & below_roof
    tri = prism([(BEAM, 0), (S_END, 0), (BEAM, -BLK)], 0, 100)
    roof = (tri & below_roof) - Pos(0, 0, -T / math.cos(ROOF_SLOPE)) * below_roof        # T thick, falls to the V-wall
    p += vwall + roof
    for s_ in [BEAM + 16 * k for k in range(1, 20) if BEAM + 16 * k < S_END - 8]:
        p += box(s_, s_ + T, -r_v(s_ + T), 0, 0, 100) & below_roof                 # ribs under the roof: it bridges <= 16
    p += box(BEAM, BEAM + T, -BLK + 12, 0, 0, 100) & below_roof                    # ... from its front edge too
    p += inner
    p += prism([(S0, 0), (S_END, 0), (BEAM, -BLK), (S0, -BLK)], 0, FLOOR_L)        # first-layer skin over L's plan (behind
                                                                                    # the V-wall, never in the ball path): it sticks
    p &= box(0, 1000, -W, 0, 0, 100)                     # the V-wall's end pokes past the left edge
    p -= prism([(BEAM, -BLK), (BEAM + 200, -BLK + 200 * math.tan(math.radians(VDEG))), (BEAM + 200, -W - 20), (BEAM, -W - 20)],
               -1, 100)                                  # nothing of L in the ball path upstream of the gate (user: up
                                                         # to V_MIN it left a triangle of the rail end / emitter top)
    for s in (S0 + 10, (S0 + S_END) / 2, S_END - 12):    # slide ribs on the left face (the tunnel's left block is flat)
        p += yz_prism([(0, 2 - RIB), (RIB, 2), (RIB, H_WALL - 2), (0, H_WALL - 2)], s - 1.5, s + 1.5)   # 45 deg underside
    # dovetail groove in the rail: open at the front (R's tongues come in there), closed upstream at the strap's tongue
    p -= dovetail(RAIL[2], S0 - 1, BEAM + RAIL[2], RAIL_Z)
    p -= prism([(S0 - 1, Y_RAIL - MOUTH[1]), (S0 + MOUTH[0], -BLK + DOVE[0] - RAIL[2]),
                (S0 + MOUTH[0], -BLK + DOVE[2] + DOVE[3] + RAIL[2]), (S0 - 1, Y_RAIL + MOUTH[1])],
               RAIL_Z - DOVE[4] - RAIL[2], RAIL_Z + 1)   # open-top funnel: drop in, then slide
    p -= lead_in(RAIL[2], S0 + MOUTH[0], 1, RAIL_Z)                                 # where the lips start
    return p


# the roll test's box: cross walls the lid rests on, and a hollow emitter dummy under the strap
em = box(BEAM - 11, BEAM + 11, -BLK, -BLK + 12, 0, RAIL_Z)
inner_l = sum([box(s, s + T, -BLK, 0, 0, 100) & under_lid for s in (S0 + 30, S0 + 55, S0 + 80, BEAM - 11 - T)],
              (em - box(BEAM - 11 + T, BEAM + 11 - T, -BLK + T, -BLK + 12 - T, -1, RAIL_Z - BR)) & below_roof)
part_l = l_shell(inner_l)
# the lid drops into the pocket between the left wall, the front wall, the rail and the roof's front edge; the tunnel's
# roof (~3 above, EST) keeps it there. It prints flat.
LID_C = 0.2
lid = (box(S0 + T + LID_C, BEAM - LID_C, -BLK + RAIL[0] + LID_C, -T - LID_C, 0, 100) & below_roof) - under_lid
lid -= box(BEAM - 11 - LID_C, BEAM + 1, -BLK, -BLK + 12 + LID_C, 0, 100)        # around the emitter dummy

# ---- R: the KEEPER (final sled part; L stays a test unit): right skin with a PTFE recess, the receiver pod with its
# cartridge + Ø3 aperture at the beam, the 8 deg lead-in, the lead channel to a plug at the front, three bridges with
# dovetail tongues that ride in L's rail. It prints lying on its skin's outer face: no supports, round aperture.
part_r = box(R0, S_TIP, -W, -W + SKIN, 0, H_WALL)
pod = box(BEAM - POD_L / 2, BEAM + POD_L / 2, -W + SKIN, Y_POD, 0, H_TOP)
part_r += pod - box(BEAM - POD_L / 2 + T, BEAM + POD_L / 2 - T, -W + SKIN - 1, Y_POD - T, -1, H_TOP - BR)
part_r += prism([(BEAM + POD_L / 2, Y_POD), (S_TIP, -W + SKIN), (BEAM + POD_L / 2, -W + SKIN)], 0, H_WALL)   # lead-in, solid
                                                                                     # (lying on its skin it prints as a ramp)
part_r += box(BEAM + POD_L / 2 - T, BEAM + POD_L / 2, -W + SKIN, Y_POD, 0, H_WALL)        # closes the pod's upstream end
part_r += box(BEAM - POD_L / 2, BEAM + POD_L / 2, -W, -W + SKIN, 0, H_TOP)      # skin up behind the pod (as R prints, the
                                                                                 # pod's walls above H_WALL began in mid-air)
for s, h in zip(S_PEGS, BRIDGE_H):
    part_r += box(s - h, s + h, -BLK + RAIL[0], -W, RAIL_Z, H_TOP)               # bridge plate over the gate onto the rail
    part_r += box(s - h, s + h, -BLK - RAIL[2] - 0.3, Y_POD if s == BEAM else -W, Z_BR, RAIL_Z)   # deeper over the channel
    part_r += box(s - h, s + h, -W, -W + SKIN, 0, H_TOP)                          # skin-side post
    part_r += tongue(s - 8.0, s if s == BEAM else s + 8.0, RAIL_Z)          # tongue (the strap's ends at the in-stop)
YCYL = lambda s, y, z, r, h: Pos(s, y, z) * Rot(-90, 0, 0) * Cylinder(r, h, align=MINB)   # noqa: E731  axis along +y from y
# receiver CARTRIDGE (user: the drop-in cradle was too tight to fit by hand). The TEFT4300 is glued into a separate black
# printed cartridge and wired on the bench (electronics/receiver-cartridge-leads-2026-10-16.md: legs bent 90 deg UP >= 2
# behind the flange, joints shrunk). It goes into the pod's pocket FROM THE BACK through a window in the skin (user's
# markup), up to the pod's face wall, and the tunnel's right wall then keeps it in. The lead runs up its back, s- out
# of its narrow side at the channel's height, through a back-open notch in the pod's end wall into the U-channel: laid
# in, never threaded. The tip sits RX[4] behind the Ø3 aperture; the closed Ø3 tube in front of the tip is in the
# cartridge (light shield); its back faces the wood.
YS = -W + SKIN                            # skin's inner face
RX_TIP = Y_POD - RX[4]
RX_FL = RX_TIP - RX[3]                    # flange top face
RX_BK = RX_FL - RX[2]                     # flange back face (3.5 to the skin's inner face)
PK = (BEAM - POD_L / 2 + T, BEAM + 6.15, 1.6)   # pocket: s from the pod's end wall to an inner wall; floor thickness
CG = (0.2, 0.2, 0.75, 0.2)                # cartridge clearance: s per side, back (recessed from the skin's face), front
                                          # (under the pocket's bridged roof: v2's sagged, so it didn't go in), z.
                                          # No crush ribs (v2: "extremely tight, almost broke it")
PK_G = 0.1                                # it seats on the pocket's 45 deg fillets after PK_G more: 0.3 under the skin's face
LEADS = (4.8, 1.6)                        # lead groove width (pair <= 4.4), wire OD (EST; electronics: 26 AWG fallback)
Z_LD = H_WALL + CH[1] - CH[3]             # the lead's floor: the channel's groove bottom, also through the notch
part_r += box(PK[0], PK[1] + T, YS, Y_POD - T, 0, PK[2])                       # pocket floor
part_r += box(PK[1], PK[1] + T, YS, Y_POD - T, 0, H_TOP)                       # pocket's inner wall
PK_K = (6.0, 3.5)   # 45 deg fillets in the pocket roof's corners (end wall, inner wall): as R prints, the pod's face wall
                    # roofs the pocket, 19 wide; now it bridges 19 - 9.5 <= 10 (user: no supports). The inner one clears the Ø3 tube


def pk_fillets(g, z0, z1):        # grown by g along s / y for the cartridge's cut
    y = Y_POD - T
    return prism([(PK[0] - 1, y + 1), (PK[0] + PK_K[0] + g + 1, y + 1), (PK[0] - 1, y - PK_K[0] - g - 1)], z0, z1) + \
        prism([(PK[1] + 1, y + 1), (PK[1] - PK_K[1] - g - 1, y + 1), (PK[1] + 1, y - PK_K[1] - g - 1)], z0, z1)


part_r += pk_fillets(0.0, PK[2], H_TOP - BR)
part_r -= box(PK[0], PK[1], -W - 1, YS + 0.01, PK[2], H_TOP - BR)              # window in the skin (the way in)
part_r -= YCYL(BEAM, Y_POD - T - 0.5, BEAM_Z, 1.5, T + 1.5)                    # Ø3 aperture
part_r -= box(PK[0] - T - 0.1, PK[0] + 0.1, -W - 1, -W + CH[0] - 1, Z_LD, H_WALL + CH[1] + 0.2)   # lead notch, open behind
c0, c1 = PK[0] + CG[0], PK[1] - CG[0]
cart_body = box(c0, c1, -W + CG[1], Y_POD - T - CG[2], PK[2] + CG[3], H_TOP - BR - CG[3])
cart_body -= YCYL(BEAM, RX_TIP - 0.01, BEAM_Z, 1.5, RX[4])                    # closed Ø3 light tube to the front
cart_body -= YCYL(BEAM, RX_FL - 0.01, BEAM_Z, RX[5] / 2, RX[3] + 0.02)        # body bore
cart_body -= YCYL(BEAM, RX_BK - 3, BEAM_Z, RX[1] / 2 + 0.2, RX[2] + 3)         # flange seat, open behind (glue dot)
cart_body -= box(BEAM - LEADS[0] / 2, BEAM + LEADS[0] / 2, -W - 1, RX_BK, BEAM_Z - 3, H_WALL + CH[1] + 0.2)   # up the back
cart_body -= box(c0 - 1, BEAM + LEADS[0] / 2, -W - 1, RX_BK, Z_LD, H_WALL + CH[1] + 0.2)    # ... and out at the channel
cart_body -= box(c1 - 8, c1 - 2, -W - 1, -W + CG[1] + 1.5, PK[2], PK[2] + CG[3] + 2.5)       # pry slot (small screwdriver)
cart_body -= pk_fillets(PK_G, 0, H_TOP)      # its stop: the pocket roof's fillets (its front corners print at 45)
cart = cart_body
rx = YCYL(BEAM, RX_FL, BEAM_Z, RX[0] / 2, RX[3]) + YCYL(BEAM, RX_BK, BEAM_Z, RX[1] / 2, RX[2])
W_Y = (-W + CH[0] / 2 - LEADS[1] / 2, -W + CH[0] / 2 + LEADS[1] / 2)          # one wire wide, on the channel's centre
rx_leads = box(BEAM - 2.2, BEAM + 2.2, RX_BK - 3.5, RX_BK, BEAM_Z - 0.9, BEAM_Z + 11) \
    + box(BEAM - LEADS[1], BEAM + LEADS[1], *W_Y, BEAM_Z + 11, Z_LD + 0.1 + 2 * LEADS[1]) \
    + box(BEAM - POD_L / 2 + 0.15, BEAM + LEADS[1], *W_Y, Z_LD + 0.1, Z_LD + 0.1 + 2 * LEADS[1])
# electronics' envelope (pair <= 4.4 wide x 3.5 deep behind the flange, stiff for 11 along the leg), then the jackets
# side by side up the groove and stacked toward the notch; hot glue over the jackets above the stiff zone grips them

# lead channel: a U on top of the skin from R's front end to the pod's end wall, where the leads end in a 2-pin plug
# Its outer wall leans out 45 deg (user: as R prints on its skin, a straight one hung 3.4 over the groove); balls clear it
LIP = H_WALL + CH[1] - Z_LD
G_Y = (-W + (CH[0] - CH[2]) / 2, -W + (CH[0] + CH[2]) / 2)
part_r += yz_prism([(-W, H_WALL), (-W + CH[0], H_WALL), (-W + CH[0] + CH[1], H_WALL + CH[1]), (-W, H_WALL + CH[1])],
                   R0, BEAM - POD_L / 2 + 0.1)
ch_groove = yz_prism([(G_Y[0], Z_LD), (G_Y[1], Z_LD), (G_Y[1] + LIP + 1, H_WALL + CH[1] + 1), (G_Y[0], H_WALL + CH[1] + 1)],
                     R0 - 1, BEAM - POD_L / 2 + 0.2)
part_r -= ch_groove                                                              # also under the bridges (open sideways)
wire_route = box(R0 + 0.5, BEAM - POD_L / 2 - 0.1, *W_Y, Z_LD + 0.1, Z_LD + 0.1 + 2 * LEADS[1])   # the stacked pair (rx_leads
                                                                                 # carries it through the notch)
part_r -= box(R0 + 2, BEAM - POD_L / 2 - 1, -W + SKIN - PTFE[1], -W + SKIN + 0.1, 2.0, 2.0 + PTFE[0])   # PTFE tape recess

# ---- gauge marks: scale on L's lid (mm from L's front face), BEAM, z = 17 lines at the gate --------------------------
FONT = Path(matplotlib.get_data_path()) / "fonts" / "ttf" / "DejaVuSans-Bold.ttf"
if not FONT.is_file():
    sys.exit(f"font missing: {FONT}")


def label(txt, size, x, y, z, depth=0.5):     # engraved, reads from the opening (text up = into the tunnel)
    return Pos(x, y, z) * Rot(0, 0, -90) * extrude(Text(txt, font_size=size, font_path=str(FONT)), -depth)


top_skin = box(-1000, 1000, -1000, 1000, -100, 200) - Pos(0, 0, -0.5) * below_roof   # 0.5 under the roof plane, up
for k in range(10, int(BEAM - S0), 10):                  # scale on the lid's top along its left edge: mm from L's front face
    long_ = k % 50 == 0
    lid -= box(S0 + k - 0.4, S0 + k + 0.4, -T - (7 if long_ else 4.5), -T, 0, 100) & top_skin
    part_l -= box(S0 + k - 0.4, S0 + k + 0.4, -T - 0.1, 0.1, 0, 100) & Pos(0, 0, -(3.0 if long_ else 1.5)) * top_skin   # and
                                                                         # nicks in the left wall's top (no lid: the test)
    if long_:
        lid -= label(str(k), 4.0, S0 + k + 4.5, -T - 9.0, ROOF_Z + 2, depth=12) & top_skin
part_r -= box(BEAM - 0.5, BEAM + 0.5, -BLK + RAIL[0] + 1, -W + 2, H_TOP - 0.5, H_TOP + 1)  # beam line across the strap
part_r -= label("BEAM", 4.0, BEAM + 6, (-BLK - W) / 2 + 4, H_TOP)
part_r -= label("R  WALL >", 3.5, S_PEGS[0] - BRIDGE_H[0] + 1, (-BLK - W) / 2 + 8, H_TOP)
part_l -= box(BEAM - 10, BEAM + 10, -BLK - 0.5, -BLK + 0.5, 16.6, 17.4)          # z 17 line on the gate faces

# ---- 1:10 wedge gauge for the gaps (roof, frame step, the float at the left wall): thickness 1 + x/10 mm --------------------------
WEDGE = (150.0, 10.0)
wedge = Pos(0, 0, 0) * Rot(90, 0, 0) * extrude(Polygon((0, 0), (WEDGE[0], 0), (WEDGE[0], 1 + WEDGE[0] / 10), (0, 1), align=None), WEDGE[1])
for t in range(1, 17):
    x = (t - 1) * 10
    wedge -= Pos(x, 0, 0) * box(-0.4, 0.4, -WEDGE[1] - 1, -WEDGE[1] + (6 if t % 5 == 0 else 3.5), -1, 100)
    if t % 2 == 0:
        wedge -= Pos(x + 1.5, -WEDGE[1] + 4.5, 1 + x / 10) * extrude(Text(str(t), font_size=3.0, font_path=str(FONT),
                                                                        align=(Align.MIN, Align.MIN)), -0.6)
balls = [Pos(3 + BALL[1] / 2 + k * BALL[1], -W + BALL[1] / 2 + 0.2, BALL[1] / 2) * Sphere(BALL[1] / 2) for k in range(3)]


# ---- fit coupon (user: check the rail before the big plates; lead: as small as checks the mechanism): 25 of L's rail
# on a 2 mm foot, upright as L prints; R's mid-bridge tongue + an 8 mm stub of the deep bridge on a skin-thick pad,
# lying on the pad like R on its skin (same print Z, same 45 deg overhangs, layers in phase with R's). Slide it in along s
CP = (S_PEGS[1] - 12.5, S_PEGS[1] + 12.5)
coupon_l = (part_l & box(*CP, -BLK - 1, -BLK + RAIL[0], 32, RAIL_Z + 1)) + box(*CP, -BLK, -BLK + RAIL[0], 30, 32)
coupon_l -= lead_in(RAIL[2], CP[0], 1, RAIL_Z) + lead_in(RAIL[2], CP[1], -1, RAIL_Z)
Y_PAD = -W + round((-BLK - RAIL[2] - 0.3 - 8 - SKIN + W) / 0.2) * 0.2      # pad's bed face, a whole 0.2 layer count above R's
coupon_r = (part_r & box(S_PEGS[1] - BRIDGE_H[1], S_PEGS[1] + BRIDGE_H[1], Y_PAD + SKIN, -BLK + RAIL[0] + 1, 30, 50)) \
    + box(S_PEGS[1] - 10, S_PEGS[1] + 10, Y_PAD, Y_PAD + SKIN, Z_BR - 4, H_TOP + 3)

# ---- build plates: a 256 x 256 bed (Bambu A1/P1S/X1C), each part on its print face, turned only about Z.
# Seam (coupon 3: a seam bump at one end stopped the tongue): slice with seam position "Back", and the parts are turned so
# that every printed loop's rearmost point is off the groove / tongue / lips (checked below; "Aligned" can't be predicted
# here). That needs R and the coupons with s along the bed's Y, so R (249) needs the 3 mm edge: plate 1 is like the one
# plate (user: v1's R printed fine near the edge; R gets no brim). Plate 2: >= 10 to the edge (an 8 mm brim fits).
# One plate: R and L side by side along Y, >= 3 to the edge and >= 6 between parts, L room for a 5 mm brim (it needs none).
BED, BED_EDGE, BED_GAP = 256.0, 10.0, 10.0
PRINT = {"R": Rot(90, 0, 0) * part_r, "cartridge": Rot(-90, 0, 0) * cart, "L": part_l,
         "lid": Rot(-math.degrees(ROOF_SLOPE), 0, 0) * lid, "wedge": wedge, "coupon_L": coupon_l, "coupon_R": Rot(90, 0, 0) * coupon_r}
TONGUES = [(s - 8.0, s if s == BEAM else s + 8.0) for s in S_PEGS]
END = LEAD_IN + 0.5                # a seam this close to a section's end is on its lead-in
SLIDING = {"L": dovetail(RAIL[2] + 0.15, S0 + MOUTH[0] + END, BEAM, RAIL_Z),     # the faces a seam bump must not touch
           "coupon_L": dovetail(RAIL[2] + 0.15, CP[0] + END, CP[1] - END, RAIL_Z),
           "R": Rot(90, 0, 0) * sum([dovetail(0.15, a + END, b - END, RAIL_Z) for a, b in TONGUES[1:]],
                                    dovetail(0.15, TONGUES[0][0] + END, TONGUES[0][1] - END, RAIL_Z)),
           "coupon_R": Rot(90, 0, 0) * dovetail(0.15, TONGUES[1][0] + END, TONGUES[1][1] - END, RAIL_Z)}
PLATES = {"roll_test_plate1": [("R", 90, 3.0, 3.3), ("cartridge", 0, 226, 206)],
          "roll_test_plate2": [("L", 12, 10.8, 116.6), ("wedge", 0, 10, 10)],
          "roll_test_lid": [("lid", 0, (BED - 156.4) / 2, (BED - 71.3) / 2)],   # for later: the roll test runs without it (user)
          "roll_test_coupon": [("coupon_L", 90, 112, 115.5), ("coupon_R", 90, 132, 118)],   # centred
          "roll_test_oneplate": [("R", 90, 3.0, 3.3), ("L", 90, 57.0, 8.3), ("wedge", 90, 151.4, 3.0),
                                 ("cartridge", 0, 167.4, 3.0)]}
PLATE_RULES = {"roll_test_oneplate": (3.0, 6.0, {"L": 5.0}), "roll_test_plate1": (3.0, 6.0, {})}   # edge, gap, brim per
                                                                                  # part (others: BED_EDGE, BED_GAP, none)


def on_plate(name, deg, x, y, shape=None):   # the part (or shape, moved with it) turned deg about Z, its footprint's
    b = (Rot(0, 0, deg) * PRINT[name]).bounding_box()     # corner at (x, y), standing on the bed
    return Pos(x - b.min.X, y - b.min.Y, -b.min.Z) * Rot(0, 0, deg) * (PRINT[name] if shape is None else shape)


def back_seams(name, deg):        # seam "Back": each 0.2 layer's loops put their seam at their rearmost (max Y) point;
    p, zone = on_plate(name, deg, 0, 0), on_plate(name, deg, 0, 0, SLIDING[name])   # count those on a sliding face
    zb, hits = zone.bounding_box(), 0
    for k in range(max(0, int(zb.min.Z / 0.2)), int(zb.max.Z / 0.2) + 1):
        for f in section(p, Plane.XY.offset(k * 0.2 + 0.1)).faces():
            for wire in [f.outer_wire(), *f.inner_wires()]:
                pts = [e.position_at(t) for e in wire.edges() for t in (0, 0.25, 0.5, 0.75, 1)]
                ym = max(q.Y for q in pts)
                hits += any(q.Y > ym - 0.05 and zone.distance_to(q) < 0.05 for q in pts)
    return hits


def check_plate(plate):           # fails when a part overflows the bed's margin or comes within BED_GAP of another
    edge, gap, brim = PLATE_RULES.get(plate, (BED_EDGE, BED_GAP, {}))
    placed = [(n, on_plate(n, *xy)) for n, *xy in PLATES[plate]]
    for n, p in placed:
        b, m = p.bounding_box(), edge + brim.get(n, 0)
        assert min(b.min.X, b.min.Y) >= m - 1e-6 and max(b.max.X, b.max.Y) <= BED - m + 1e-6, \
            f"{plate}: {n} overflows the {BED:.0f} bed's {m:.0f} margin"
    layer = box(-1e3, 1e3, -1e3, 1e3, -1, 0.3)
    for i, (a, pa) in enumerate(placed):
        for b_, pb in placed[i + 1:]:
            g = gap + brim.get(a, 0) + brim.get(b_, 0)
            assert min((pa & layer).distance_to(pb & layer), pa.distance_to(pb)) >= g - 1e-6, \
                f"{plate}: {a} and {b_} closer than {g:.0f} (gap + brim)"
    return placed


def overhangs(p, lim=45.0):        # faces facing down more than lim from vertical, off the bed (supports off)
    z0 = p.bounding_box().min.Z
    return [f for f in p.faces() if f.normal_at().Z < -math.sin(math.radians(lim)) - 1e-3
            and f.bounding_box().min.Z > z0 + 0.05 and f.area > 0.01]


def unbridged(p, span, lim=45.0):   # overhangs that are neither tiny (<= 1 across: engravings) nor a bridge: along X or Y,
    def solid(q):                    # rows across the face at 20/50/80 % are each <= span with material just past both ends
        h = p & q
        return bool(h.solids()) and h.volume > 0.02

    def bridged(f, b, k):            # k = 0: rows along X
        lo_, hi_ = (b.min.Y, b.max.Y) if k == 0 else (b.min.X, b.max.X)
        for t in (0.2, 0.5, 0.8):
            u = lo_ + t * (hi_ - lo_)
            cut = box(-1e4, 1e4, u - 0.01, u + 0.01, -1e4, 1e4) if k == 0 else box(u - 0.01, u + 0.01, -1e4, 1e4, -1e4, 1e4)
            for row in (f & cut).faces():
                r = row.bounding_box()
                e0, e1, z = (r.min.X, r.max.X, r.center().Z) if k == 0 else (r.min.Y, r.max.Y, r.center().Z)
                ends = [(e0 - 0.6, e0 - 0.1), (e1 + 0.1, e1 + 0.6)]
                if e1 - e0 > span or not all(solid(box(a0, a1, u - 0.25, u + 0.25, z, z + 0.6) if k == 0 else
                                                   box(u - 0.25, u + 0.25, a0, a1, z, z + 0.6)) for a0, a1 in ends):
                    return False
        return True
    return [f for f in overhangs(p, lim) if (lambda b: min(b.size.X, b.size.Y) > 1.0 and
                                             not (bridged(f, b, 0) or bridged(f, b, 1)))(f.bounding_box())]


def opening_width_at(h):          # usable width of the R-cornered opening for a part h high, centred in its height
    e = max(0.0, OPEN[2] - (OPEN[1] - h) / 2)                                  # corner arc depth at the part's top/bottom
    return OPEN[0] - 2 * (OPEN[2] - math.sqrt(OPEN[2] ** 2 - e ** 2)) - 2 * CLR_OPEN


def nothing(a, b):                 # a and b don't overlap (more than meshing noise)
    if not a.solids() or not b.solids():
        return True
    h = a & b
    return not h.solids() or h.volume < 0.05


def shared_checks(part_l, part_r, cart, lid):   # what the sled (sled.py) inherits: queue, opening, envelope, roof,
    # the rail joint, the ball path
    assert BLK > 30 and abs(Y_POD - (-BLK) + GATE) < 1e-6, "gate isn't GATE wide"
    assert GATE >= BALL[1] + 4, "gate too narrow for a 36 ball"
    n_q = int((BEAM - Q0) // BALL[1])        # firmware: a ball resting IN the beam blinds it until the drawer is emptied
    assert n_q >= N_MIN, f"only {n_q} balls of 36 queue clear of the beam at s {BEAM:.0f} (need {N_MIN})"
    whole = part_l + part_r + cart + lid
    # fit 1: L ends before the block's end; one print; it and R pass the frame opening, then ride up the step
    assert S_END <= L_MAX + 1e-6, f"L's tip at s {S_END:.0f}: past {L_MAX:.0f} (fit 1: it hit the angled board)"
    for name, rigid in (("L", part_l), ("R", part_r)):
        b = rigid.bounding_box()
        assert b.size.Y <= opening_width_at(b.size.Z) and b.size.Z + 3 <= OPEN[1] + 1e-6, \
            f"{name} is {b.size.Y:.1f} wide x {b.size.Z:.1f} high: doesn't pass the {OPEN[0]:.0f} x {OPEN[1]:.0f} opening"
        assert b.max.Z <= MOUTH_CLEAR - CLR_TOP + 1e-6, f"{name} too high for the mouth (over the ~10 step)"
    # width: the ribs take up the spare width but L still slides (lead: float <= ~2.5); R's skin on the right wall line
    assert 1.5 <= GAP <= 2.5 and abs(part_l.bounding_box().max.Y - RIB) < 1e-6, f"float at the left wall {GAP:.1f} (want 1.5-2.5)"
    assert abs(whole.bounding_box().min.Y + W) < 1e-6, "R's skin isn't on the right wall line"
    for name, p in (("L", part_l), ("R", part_r), ("wedge", wedge)):
        b = p.bounding_box()
        assert max(b.size.X, b.size.Y) <= 250 and b.size.Z <= 250, f"{name} doesn't fit the 256 bed"
    # fit 1: a ball can't get on top: the V-wall is >= a ball everywhere, the roof covers everything behind it
    v_low = min(ROOF_Z - r_v(s) * math.tan(ROOF_SLOPE) for s in (BEAM, (BEAM + S_END) / 2))
    assert v_low >= BALL[1] + 1 - 1e-6, f"V-wall only {v_low:.1f} high (a 36 ball can climb it)"
    probes = [box(s - 0.5, s + 0.5, -r_v(s) / 2 - 0.5, -r_v(s) / 2 + 0.5, V_MIN, ROOF_Z) for s in (BEAM + 30, (BEAM + S_END) / 2)]
    assert all(not nothing(p_, part_l) for p_ in probes) and ROOF_SLOPE > math.radians(3), \
        "the roof doesn't cover L behind the V-wall, or is too flat to roll a ball off"
    # joint: dovetail tongues ride in the rail with clearance; R slides in along s, stops, holds the gate, can't lift out
    assert nothing(part_r, part_l), "R and L overlap (tongues bind in the rail?)"
    for ds in (-5.0, -60.0, -150.0):
        assert nothing(Pos(ds, 0, 0) * part_r, part_l), f"R binds on L while sliding in ({ds:.0f} out)"
    assert not nothing(Pos(1.0, 0, 0) * part_r, part_l), "the rail's end doesn't stop R (in-stop)"
    assert not nothing(Pos(0, 0.3 + RAIL[2], 0) * part_r, part_l) and not nothing(Pos(0, -0.3 - RAIL[2], 0) * part_r, part_l), \
        "the tongues don't hold the gate width"
    # captive (coupon 2 slid out along the 45 deg hook + slope): a 1.0 lift, both 45 deg diagonals, a 6 deg roll (the
    # clearance allows ~5)
    escapes = [Pos(0, 0, 1.0), Pos(0, -1.0, 1.0), Pos(0, 1.0, 1.0)] + \
        [Pos(0, y, RAIL_Z) * Rot(a, 0, 0) * Pos(0, -y, -RAIL_Z) for y in (-BLK, -BLK + RAIL[0]) for a in (6.0, -6.0)]
    assert all(not nothing(m * part_r, part_l) for m in escapes), "R can lift / slide / roll out of L's rail (fit 1, coupon 2)"
    mouth = Pos(S0 + 1 - S_PEGS[2] + 8, 0, 0) * dovetail(0.0, S_PEGS[2] - 8, S_PEGS[2], RAIL_Z)
    assert all(nothing(Pos(0, 0, dz) * mouth, part_l) for dz in (0.0, 2.0, 4.5)), \
        "a tongue can't drop into the rail's mouth from above"
    stiff = [h * 2 * (H_TOP - Z_BR) ** 3 for h in BRIDGE_H[:2]]
    assert min(stiff) >= 5 * 10 * BR ** 3, "front/mid bridges not >= 5x stiffer than fit 1's 10 x 3 plates"
    # the ball path: a ball hugging the right side all the way down, passing the gate, and against the block face
    for d in BALL:
        r = d / 2 - 0.05
        hug = [Pos(x, -W + SKIN + r + 0.3, r) * Sphere(r) for x in range(int(S0) - 10, int(BEAM - POD_L / 2 - r), 12)]
        gate = [Pos(BEAM, y, r) * Sphere(r) for y in (Y_POD + r + 0.3, -BLK - r - 0.3)]   # against the pod / the block face
        assert all(nothing(b_, whole) for b_ in hug + gate), f"a {d:.0f} ball hits the test piece in its path"
    assert all(nothing(Pos(x, -W + SKIN + BALL[1] / 2 + 0.3, BALL[1] / 2) * Sphere(BALL[1] / 2 - 0.05), whole)
               for x in (S_TIP + BALL[1] / 2 + 1, S_TIP + 40)), "the lead-in tip sticks into the path upstream"
    return n_q, escapes


def self_check():
    n_q, escapes = shared_checks(part_l, part_r, cart, lid)
    # user's markup: the lid closes L's box in front of the roof; it sits in its pocket, on the cross walls, and lifts out
    probes = [box(s - 0.5, s + 0.5, -BLK / 2 - 0.5, -BLK / 2 + 0.5, V_MIN, ROOF_Z) for s in (S0 + 20, (S0 + BEAM) / 2, BEAM - 5)]
    assert all(not nothing(p_, lid) for p_ in probes) and nothing(lid, part_l) and nothing(lid, part_r), \
        "the lid doesn't cover L's box, or hits L / R"
    assert all(not nothing(Pos(*d) * lid, part_l) for d in ((0.5, 0, 0), (-0.5, 0, 0), (0, 0.5, 0), (0, -0.5, 0), (0, 0, -0.3))) \
        and nothing(Pos(0, 0, 3) * lid, part_l), "the lid isn't located in its pocket on the cross walls, or can't lift out"
    lf = Rot(-math.degrees(ROOF_SLOPE), 0, 0) * lid
    lb = lf.bounding_box()
    assert lb.size.Z <= T_LID + 0.1, "the lid doesn't print flat"
    assert nothing(coupon_r, coupon_l) and all(not nothing(m * coupon_r, coupon_l) for m in escapes) and \
        all(nothing(Pos(ds, 0, 0) * coupon_r, coupon_l) for ds in (-5.0, -15.0, -25.0)) and \
        not nothing(Pos(0, 0.3 + RAIL[2], 0) * coupon_r, coupon_l), "the fit coupon doesn't slide / hold like the rail"
    lip = [f.center().Y + BLK for f in overhangs(PRINT["coupon_L"])]   # only L's hook lip (+ its lead-ins) may pass 45
    assert not overhangs(PRINT["coupon_R"]) and not overhangs(PRINT["coupon_L"], 60.5) and \
        all(DOVE[2] < r < DOVE[2] + DOVE[3] + RAIL[2] + LEAD_IN for r in lip), \
        "fit coupon (= the real rail/tongue) overhangs more than it may as it prints (coupon 1: spaghetti)"
    # supports off (user's one-plate review): R's pocket roof, lead channel and pod walls; L's roof corner (the triangle)
    assert not unbridged(PRINT["R"], 10.2) and not unbridged(PRINT["cartridge"], 10.2) and \
        not unbridged(PRINT["L"], 16.0, 60.5), "R / the cartridge (L: past its 60 deg lip) has an overhang past 45 deg " \
        "that isn't a bridge <= 10 (L's roof: <= 16) anchored at both ends, as it prints"
    # R, the keeper: receiver well, lead path, channel, PTFE recess; it prints flat on its skin
    assert abs(BEAM_Z - 17.0) <= 0.5 and BALL[0] / 2 - 1.5 <= BEAM_Z <= BALL[1] / 2 + 2, "beam not at 17 (31-36 balls)"
    # the receiver cartridge: fits the pocket, drops in from the top onto its floor, holds the TEFT4300 at the aperture
    held = rx + rx_leads + wire_route
    assert nothing(cart_body, part_r) and all(nothing(Pos(*d) * Pos(0, -1, 0) * cart_body, part_r) for d in
                                              ((0.19, 0, 0), (-0.19, 0, 0), (0, 0, 0.19), (0, 0, -0.19))), \
        "the cartridge isn't >= 0.2 clear per side in the pocket (v2: crush ribs, far too tight)"
    seated = Pos(0, PK_G, 0) * cart_body
    assert nothing(Pos(0, -0.01, 0) * seated, part_r) and not nothing(Pos(0, 0.2, 0) * seated, part_r) and \
        Y_POD - T - seated.bounding_box().max.Y >= 0.5 and 0.0 <= seated.bounding_box().min.Y + W <= 0.3 + 1e-6, \
        "the cartridge doesn't seat on the fillets 0.5+ clear of the bridged roof (v2: it sagged) and 0-0.3 under the skin"
    assert TONGUES[0][0] >= S0 + MOUTH[0] + LEAD_IN, "the front tongue rides in the rail's open funnel (v2: barely engaged)"
    assert nothing(rx, cart) and not nothing(Pos(0, 0.1, 0) * rx, cart), "the TEFT4300 isn't seated 4 behind the aperture"
    assert nothing(rx_leads, cart) and nothing(held, part_r) and nothing(held + cart, part_l), \
        "the leads (electronics' envelope) don't fit the cartridge / the route, or hit L"
    assert all(nothing(Pos(0, -dy, 0) * (cart_body + rx + rx_leads), part_r) for dy in (2, 6, 15, 30)), \
        "the wired cartridge can't go in from the back (through the skin's window)"
    lift = H_WALL + CH[1] + 0.05 - (Z_LD + 0.1)                           # the pair lifted clear of the channel's walls
    assert Z_BR - 0.05 - (H_WALL + CH[1] + 0.05) >= 2 * LEADS[1] and nothing(Pos(0, 0, lift) * wire_route, part_r) and \
        nothing(box(R0 + 0.5, PK[0] - T - 0.2, W_Y[0], Y_POD + 10, H_WALL + CH[1] + 0.05, Z_BR - 0.05), part_r), \
        "the lead can't be laid into its route (from above, or sideways under the bridges)"
    assert RX_BK - YS >= 3.5 - 1e-6, "< 3.5 behind the flange for electronics' lead pair"
    assert CH[3] >= 2 * LEADS[1] + 0.2 - 1e-6 and CH[1] - CH[3] >= 0.8, "the stacked pair (2 x wire OD + 0.2) doesn't sink into the channel"
    tube_wall = box(BEAM - 0.3, BEAM + 0.3, RX_TIP + 0.5, Y_POD - T - 0.2, BEAM_Z - 2.3, BEAM_Z - 1.7)
    assert not nothing(tube_wall, cart), "the Ø3 light tube in front of the tip isn't a closed hole"
    cf = Rot(-90, 0, 0) * cart
    cb = cf.bounding_box()
    assert (cf & Pos(0, 0, cb.min.Z) * box(-1000, 1000, -1000, 1000, 0, 0.3)).volume >= 0.9 * (PK[1] - PK[0] - sum(PK_K) - 0.6) * (H_TOP - BR - PK[2] - 2 * CG[3]) * 0.3, \
        "the cartridge doesn't lie flat on its front face (between the fillets) for printing"
    flat = Rot(90, 0, 0) * part_r
    sb_ = flat.bounding_box()
    assert (flat & Pos(0, 0, sb_.min.Z) * box(-1000, 1000, -1000, 1000, 0, 0.3)).volume >= 0.9 * (S_TIP - R0) * H_WALL * 0.3, \
        "R doesn't lie flat on its skin for printing"
    lead = math.degrees(math.atan(POD / (S_TIP - BEAM - POD_L / 2)))
    assert abs(lead - LEAD) < 0.01, "lead-in angle"
    for plate in PLATES:
        check_plate(plate)
    rail = lambda p, s: (p & box(s - 0.05, s + 0.05, -BLK, -BLK + RAIL[0], RAIL_Z - DOVE[4] - 1, RAIL_Z)).volume   # noqa: E731
    assert all(max(rail(part_r, a + 0.05), rail(part_r, b - 0.05)) < 0.7 * rail(part_r, (a + b) / 2) for a, b in TONGUES) and \
        max(rail(coupon_l, CP[0] + 0.05), rail(coupon_l, CP[1] - 0.05)) < rail(coupon_l, sum(CP) / 2) - 0.02 and \
        rail(part_l, S0 + MOUTH[0] + 0.05) < rail(part_l, S0 + 60) - 0.02, \
        "tongue / rail ends have no lead-in (coupon 3: a seam bump at an end stopped it)"
    for name, deg in {(n, d) for pl in PLATES.values() for n, d, *_ in pl if n in SLIDING}:
        assert back_seams(name, deg) == 0, f"{name} turned {deg} deg: seam 'Back' lands on a groove / tongue face (coupon 3)"
    first = part_l & box(-1000, 1000, -1000, 1000, 0, 0.2)
    assert first.area / 2 >= 0.6 * ((S_END - S0) * BLK) * 0.5, "L: first layer is thin rails only (it lifts)"
    assert part_l.is_valid and part_r.is_valid and wedge.is_valid and cart.is_valid and lid.is_valid
    vol = (part_l.volume + part_r.volume + cart.volume + lid.volume + wedge.volume) / 1000
    print(f"roll test: L {S_END - S0:.0f} long x {BLK:.0f} (+ {RIB:.0f} ribs), {part_l.bounding_box().size.Z:.0f} high; R {S_TIP - R0:.0f} x "
          f"{part_r.bounding_box().size.Y:.0f}; spans {W + RIB:.0f} in a {TUNNEL[0]:.1f} tunnel; gate {GATE:.0f} at s {BEAM:.0f} "
          f"({n_q} balls queue clear of it); V-wall {VDEG:.0f} deg to s {S_END:.0f}; lead-in {LEAD:.0f} deg to s {S_TIP:.0f}; "
          f"~{vol * 1.27:.0f} g PETG solid ({vol:.0f} cm3: ~{vol * 1000 / 12 / 3600 * 1.25:.1f} h at 12 mm3/s + 25 % travel)")


def comparison(path):
    """Top view, same scale: the roll test (as printed) vs the proposed sled (drawer-v4-concept.md)."""
    import matplotlib.pyplot as plt
    from matplotlib.patches import Polygon as Pg, Rectangle

    fig, axs = plt.subplots(2, 1, figsize=(13, 9.6), sharex=True)

    def common(ax, title):
        ax.add_patch(Rectangle((0, -W), TUNNEL[2], TUNNEL[0], fc="#f4efe6", ec="#8a7f6c", lw=1.5))   # tunnel floor
        ax.add_patch(Rectangle((0, -W), 35, OPEN[0], fc="#333", alpha=0.18, ec="#333"))           # frame (right-aligned: e_R ~ 0?)
        ax.text(17, -W + OPEN[0] + 2, "frame\n130 open", ha="center", va="bottom", fontsize=7)
        ax.add_patch(Rectangle((285, -W), TUNNEL[2] - 285, TUNNEL[0], fc="#cfe3f5", alpha=0.5, ec="none"))
        ax.text(400, GAP - 4, "goal opening / drop zone (s 285-490)", ha="center", va="top", fontsize=8, color="#2b5c8a")
        ax.plot([BEAM, BEAM], [-W, Y_POD + GATE], color="#d33", lw=2)
        ax.text(BEAM, -W - 4, "beam", ha="center", va="top", color="#d33", fontsize=8)
        ax.set_title(title, loc="left", fontsize=11)
        ax.set_aspect("equal")
        ax.set_ylim(-W - 14, GAP + 14)
        ax.set_yticks([])

    def ball_path(ax):
        ax.add_patch(Pg([(BEAM, -BLK), (S_END, 0), (S_END + 1.5, 0), (BEAM + 1.5, -BLK)], color="#2e3440"))
        ax.add_patch(Pg([(BEAM, 0), (S_END, 0), (BEAM, -BLK)], fc="#a3be8c", alpha=0.5, ec="#5e7a4e"))
        ax.add_patch(Rectangle((BEAM - POD_L / 2, -W + SKIN), POD_L, POD, color="#5e81ac"))
        ax.add_patch(Pg([(BEAM + POD_L / 2, Y_POD), (S_TIP, -W + SKIN), (BEAM + POD_L / 2, -W + SKIN)], color="#5e81ac", alpha=0.6))
        ax.plot([S0, BEAM], [-BLK, -BLK], color="#2e3440", lw=2)

    def notes(ax, items):
        for txt, xy, xyt in items:
            ax.annotate(txt, xy, xyt, fontsize=8, arrowprops=dict(arrowstyle="-", color="#666", lw=0.8))

    def bridges(ax):
        for s, h in zip(S_PEGS, BRIDGE_H):
            ax.add_patch(Rectangle((s - h, -W), 2 * h, W - BLK + RAIL[0], fc="#5e81ac", alpha=0.45))

    def box_text(ax, txt):
        ax.text(TUNNEL[2] - 4, -W + 30, txt, ha="right", va="center", multialignment="left", fontsize=8, linespacing=1.35,
                bbox=dict(fc="white", ec="#999", alpha=0.9))

    ax = axs[0]
    common(ax, "Roll test (this print): L + R, joined inside; no electronics")
    ax.add_patch(Rectangle((S0, -BLK), S_END - S0, BLK, fc="#88c0d0", alpha=0.35, ec="#4c7a8c"))
    ax.add_patch(Rectangle((R0, -W), S_TIP - R0, SKIN, color="#5e81ac"))
    bridges(ax)
    ball_path(ax)
    box_text(ax, f"REPRODUCES the sled's ball path:\n• channel 40 along the right wall, gate + beam line at {BEAM:.0f}\n"
                 f"• pod (receiver cartridge) + 8° lead-in, V-wall {VDEG:.0f}° under a roof\n• slide ribs to the left wall (~2.5 float)\n"
                 "• the insertion: L in, R slides in on the rail, out in reverse\n• queue / rebound room (BEAM mark), stays-put")
    ax.plot([S0, BEAM], [Y_RAIL, Y_RAIL], ls="--", color="#4c566a", lw=1)
    for k in range(3):
        ax.add_patch(plt.Circle((Q0 + 18 + 36 * k, -W + 18.2), 18, fc="white", ec="#888"))
    notes(ax, [("L: dovetail rail (R's tongues ride in it)", (90, Y_RAIL), (60, GAP + 4)),
               (f"V-wall {VDEG:.0f}°", ((BEAM + S_END) / 2, -BLK / 2), (300, -45)),
               ("roof behind the V-wall", (BEAM + 20, -12), (200, GAP + 4)),
               ("R: skin + pod + lead-in, 3 bridges (tongues)", (230, -W + 2), (300, -W + 62)),
               ("queue in the tube", (40, -W + 30), (10, -W + 60))])

    ax = axs[1]
    common(ax, "Sled (concept): the same ball path, plus the electronics on L")
    ax.add_patch(Rectangle((S0, -BLK), S_END - S0, BLK, fc="#d8dee9", alpha=0.6, ec="#4c566a"))
    ax.add_patch(Rectangle((R0, -W), S_TIP - R0, SKIN + 0.6, color="#ebcb8b"))
    bridges(ax)
    ball_path(ax)
    box_text(ax, "ADDS on top of the roll test:\n• real emitter (L) + receiver (R); receiver lead plugs at the front\n"
                 "• 3×AA flat + hatch, board, USB-C on L's front face\n• PTFE-taped skin; R is final (the roll test's R)\n"
                 "• retention: L seats on the cabinet wall, rubber feet,\n  spring fingers to the roof")
    ax.add_patch(Rectangle((S0 + 4, -BLK + 8), 68.8, 47.8, fc="#bf616a", alpha=0.75))
    ax.text(S0 + 38, -BLK + 32, "3×AA flat\n+ top hatch", ha="center", va="center", fontsize=8, color="white")
    ax.add_patch(Rectangle((112, -BLK + 16), 70, 30, fc="#b48ead", alpha=0.8))
    ax.text(147, -BLK + 31, "board (XIAO)", ha="center", va="center", fontsize=8, color="white")
    ax.add_patch(Rectangle((BEAM - 6, -BLK + 1), 12, 10, fc="#d08770"))
    ax.add_patch(Rectangle((S0 - 2, -BLK + 60), 3, 12, fc="#2e3440"))
    for s in (110.0, 200.0):
        ax.add_patch(plt.Circle((s, -10), 4, fc="#4c566a"))
    for s in (125.0, 215.0):
        ax.add_patch(Rectangle((s, -BLK + 40), 18, 4, fc="#a3be8c"))
    notes(ax, [("PTFE-taped skin (R)", (150, -W + 1), (150, -W + 25)),
               ("emitter well (L) / receiver pod (R)", (BEAM, -BLK + 6), (300, -BLK + 30)),
               ("USB-C on L's front face", (S0 - 1, -BLK + 66), (-2, GAP + 4)),
               ("rubber feet + spring fingers (retention)", (110, -10), (90, GAP - 2)),
               ("receiver lead: plug at the front", (S0 + 4, -W + 6), (60, -W - 10))])
    axs[1].set_xlabel(f"s, mm from the frame's outer face. Top view, right wall at the bottom; tunnel width EST "
                      f"{TUNNEL[0]:.0f} (frame drawn on the right wall: e_R unknown)")
    fig.tight_layout()
    fig.savefig(path, dpi=110)
    plt.close(fig)


if __name__ == "__main__":
    self_check()
    if "--check" in sys.argv:
        sys.exit()
    OUT.mkdir(exist_ok=True)
    # print orientations, supports off: R lying on its skin's outer face, the cartridge on its front face (black), L upright,
    # the lid and the wedge flat. Plate 1 = R + cartridge (the reprint), plate 2 = L + wedge, the lid alone (later).
    bed = box(0, BED, 0, BED, -0.6, -0.3) + box(0, BED, 0, BED, -0.6, -0.3)
    colours = {"coupon_R": "#5e81ac", "coupon_L": "#88c0d0", "R": "#5e81ac", "cartridge": "#3b4252", "L": "#88c0d0", "lid": "#a3c9d6", "wedge": "#d08770"}
    for plate in PLATES:
        placed = check_plate(plate)
        m = Mesher()
        for _, p in placed:
            m.add_shape(p)
        m.write(str(OUT / f"{plate}.3mf"))
        e = PLATE_RULES.get(plate, (BED_EDGE,))[0]
        usable = box(e, BED - e, e, BED - e, -0.3, -0.1)
        render(OUT / f"{plate}.png", [(bed, "#c8c8c8", 1), (usable, "#eeeeee", 1)] + [(p, colours[n], 1) for n, p in placed],
               view=(0, 0, 1), up=(0, 1, 0), size=(900, 900),
               title=f"{plate}: 256 x 256 bed, >= {PLATE_RULES.get(plate, (BED_EDGE,))[0]:.0f} to the edge")
        if plate == "roll_test_coupon":       # as it prints (lead): L upright, R on its pad with the tongue on top
            near = box(90, 166, 112, 144, -0.6, -0.1)
            render(OUT / f"{plate}_3d.png", [(near, "#dddddd", 1)] + [(p, colours[n], 1) for n, p in placed],
                   view=(-0.5, -1, 0.75), size=(1000, 750), title="Fit coupon as it prints, supports off: "
                   "L's rail (left), R's tongue on stub + pad (right)")
            render(OUT / f"{plate}_end.png", [(coupon_l, colours["coupon_L"], 1), (coupon_r, colours["coupon_R"], 1)],
                   view=(-1, 0, 0), up=(0, 0, 1), size=(1200, 800), title=f"Coupon end view, mated: hook {DOVE[3]:.0f} mm "
                   f"over at {DOVE[5]:.0f} deg, 45 deg slope (R's pad right)")
    for name, p in (("roll_test_r", part_r), ("roll_test_l", part_l), ("roll_test_cartridge", cart), ("roll_test_lid", lid),
                    ("roll_test_wedge", wedge)):
        export_stl(p, str(OUT / f"{name}.stl"))
    tunnel = box(0, TUNNEL[2], -W, GAP, -3, 0) + box(0, TUNNEL[2], GAP, GAP + 3, -3, TUNNEL[1]) \
        + box(0, TUNNEL[2], -W - 3, -W, -3, TUNNEL[1])
    render(OUT / "roll_test.png", [(tunnel, "#e8dcc8", 0.35), (part_l + lid, "#88c0d0", 1), (part_r + cart, "#5e81ac", 1),
                                   (balls, "#eeeeee", 1)], view=(-0.35, 0.55, 0.75),
           title=f"Roll test v2 in a ~{TUNNEL[0]:.0f} tunnel (right wall at the back): L (light), R (dark), beam at s {BEAM:.0f}")
    render(OUT / "roll_test_parts.png", [(Pos(0, 170, 0) * part_r, "#5e81ac", 1), (part_l, "#88c0d0", 1),
                                         (Pos(0, 0, 30) * lid, "#a3c9d6", 1)],
           view=(-0.45, -0.6, 0.75), title="The two units as they go in: R (back), L (front) and its lid (lifted); "
           "R's tongues ride in L's rail")
    render(OUT / "roll_test_dovetail.png", [((part_l & box(S_PEGS[1] - 30, S_PEGS[1] + 30, -BLK - 2, -BLK + 14, 20, 50)), "#88c0d0", 1),
                                           ((part_r & box(S_PEGS[1] - 30, S_PEGS[1] + 30, -BLK - 30, -BLK + 14, 20, 50)), "#5e81ac", 1)],
           view=(-1, -0.25, 0.35), size=(1000, 750),
           title="Captive rail: R's bridge (5 deep, 16 wide) + dovetail tongue in L's rail")
    comparison(OUT / "roll_test_vs_sled.png")
    render(OUT / "roll_test_r.png", [(part_r, "#5e81ac", 1), (cart, "#3b4252", 1), (rx, "#bf616a", 1), (rx_leads + wire_route, "#ebcb8b", 1)],
           view=(-0.3, 1, 0.6), size=(1100, 750),
           title="R, the keeper: pod + cartridge (black), open lead route, 3 stiff bridges")
    near = box(BEAM - 40, BEAM + 30, -W - 1, Y_POD + 2, -1, 50)
    out_ = Pos(0, -35, 0)
    render(OUT / "roll_test_cartridge.png", [(part_r & near, "#5e81ac", 1), (out_ * cart, "#3b4252", 1), (out_ * rx, "#bf616a", 1),
                                            (out_ * rx_leads, "#ebcb8b", 1), (wire_route & near, "#ebcb8b", 1)],
           view=(-0.55, -1, 0.45), size=(1000, 850),
           title="Receiver cartridge (wired on the bench) goes into the pod from the back")
    render(OUT / "roll_test_cartridge_back.png", [(cart, "#3b4252", 1), (rx, "#bf616a", 1), (rx_leads, "#ebcb8b", 1)],
           view=(0.2, -1, 0.35), size=(900, 900),
           title="Cartridge from the back: legs bent up, lead out at the channel's height")
    # as they print, supports off (user's one-plate review): R's pod cut at z 20, L's roof corner at the gate
    render(OUT / "roll_test_pod_3d.png", [(PRINT["R"] & box(BEAM - 30, BEAM + 18, -36, -20, -200, 0), "#5e81ac", 1)],
           view=(-0.5, 1, 0.8), size=(1100, 800), title=f"R's pod as it prints, cut at z 20: pocket roof bridges "
           f"{PK[1] - PK[0] - sum(PK_K):.1f}, 45 deg fillets + channel lip")
    render(OUT / "roll_test_roof_3d.png", [(part_l & box(BEAM - 25, BEAM + 30, -BLK - 2, -BLK + 45, 0, 60), "#88c0d0", 1)],
           view=(-0.6, -0.9, 0.8), size=(1100, 800),
           title="L's roof corner as it prints: nothing past the V-wall, a wall under the roof's front edge")
    # roll test v2 fixes, top-down sections: the cartridge seated (z 20) and the front tongue in L's rail (z 38)
    pk = box(PK[0] - 3, PK[1] + 3, -W - 1, Y_POD + 1, 0, 20)
    render(OUT / "roll_test_pocket.png", [(part_r & pk, "#5e81ac", 1), (Pos(0, PK_G, 0) * cart & pk, "#3b4252", 1)],
           view=(0, 0, 1), up=(0, 1, 0), size=(1100, 800), title=f"Cartridge seated on the fillets, z 20 cut: {CG[0]:.1f} "
           f"a side, {CG[2] - PK_G:.2f} under the roof, {CG[1] + PK_G:.1f} under the skin")
    fb = box(S0 - 2, S0 + 50, -BLK - 4, -BLK + RAIL[0] + 2, 0, RAIL_Z - 2)
    render(OUT / "roll_test_front_bridge.png", [(part_l & fb, "#88c0d0", 1), (part_r & fb, "#5e81ac", 1)],
           view=(0, 0, 1), up=(0, 1, 0), size=(1100, 600), title=f"Front tongue in L's rail (z {RAIL_Z - 2:.0f} cut): "
           f"s {TONGUES[0][0]:.0f}-{TONGUES[0][1]:.0f}, all past the funnel + lead-in (to s {S0 + MOUTH[0] + LEAD_IN:.0f})")
    print("exported: out/roll_test_plate1.3mf (R + cartridge), out/roll_test_plate2.3mf (L + wedge), roll_test_lid.3mf, roll_test_oneplate.3mf, roll_test_coupon.3mf (+ _3d/_end.png), _pod_3d/_roof_3d/_pocket/_front_bridge.png, + .png "
          "_r/_l/_cartridge/_lid/_wedge.stl, renders out/roll_test*.png")
