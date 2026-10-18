"""Foosball goal-drawer insert: funnel + IR gate + electronics bay. build123d, units mm.

    uv run python insert.py          # self-check, then STL/3MF + PNG renders into out/
    uv run python insert.py --check  # self-check only
    uv run python insert.py --video  # also untitled 1920x1440 transparent stills into out/video/

Frame: x across the drawer (0 = left drawer wall), y along the ball's travel
(0 = upstream tip of the V-walls), z up from the drawer floor. Everything is
built relative to the drawer floor, so the drawer's slope only enters the
stall check. Geometry is written in "u" = distance from the nearest drawer
wall and mirrored for the right side.
"""
import math
import sys
from pathlib import Path

from render import render
from build123d import (Align, Box, Cylinder, Kind, Location, Mesher, Plane, Polygon, Pos, Rectangle,
                       Rot, export_stl, extrude, mirror, offset)

# ---- drawer: MEASURE THESE ------------------------------------------------
DRAWER_W = 150.0          # inner width (user-confirmed)
DRAWER_H = 80.0           # inner height (user-confirmed)
DRAWER_L = 350.0          # inner length (user, approx.)
DRAWER_SLOPE_DEG = 1.6    # floor tilt toward the collection end (user: 10-20 mm over 350 -> 1.6-3.3; worst case)
ENTRANCE_END_Y = 200.0    # drawer upstream end -> downstream edge of goal-entrance opening (user, approx.)
ENTRANCE_ERR = 10.0       # uncertainty on ENTRANCE_END_Y; the ramps cover it
BALL_D = 35.0             # user-measured (Garlando)
SIDE_GAP = 1.0            # per side, insert to drawer wall (room for tape on the outer faces)

# ---- ball path --------------------------------------------------------------
CH_W = 40.0               # gate channel width: ball + 5, a slow ball never touches both walls
FUNNEL_DEG = 20.0         # V-wall angle from the travel direction; smaller = less stall risk, longer insert
WALL_MU = 0.4             # ball-on-PETG wall friction (estimate, for the stall check)
ROLL_RES = 0.015          # rolling-resistance coefficient of the ball on the drawer floor (estimate)
BALL_STORE = 73.0         # free floor downstream of the insert: the battery holder slides fully out onto it (68 + 5)
RAMP_DEG = 25.0           # under the entrance the side regions are roofed by a ramp falling toward the V-wall,
RAMP_EDGE_H = 24.0        # so a dropping ball rolls into the funnel; V-wall height there (> ball radius)
RAMP_MARGIN = 5.0         # ramps end this far downstream of the furthest ball centre (entrance edge + err - radius):
                          # a falling ball can only touch the flat top beyond with its side, and rolls back off

# ---- body -------------------------------------------------------------------
H_BODY = 55.0             # top of the body; the left lid adds LID_T on top
WALL = 3.0
FLOOR = 3.0
LID_T = 3.0
ROOF_T = 8.0              # roof over the gate = strap band (tunnel clear height = H_BODY - ROOF_T)
STRAP_W = 19.0            # strap band length along y (19 mm duct tape)
GROOVE_W, GROOVE_D = 6.0, 4.0   # wire grooves on top faces: up to 6 Ø1.4 jumpers side by side (review S4)
BEAM_Z = 17.0             # beam axis above the floor (ball centre), emitter and receiver coaxial
APERTURE_D = 3.0
RX_RECESS, TX_RECESS = 4.0, 12.0          # element tip behind the channel face; 40 + 4 + 12 = 56 mm path (electronics OK'd 56)

# ---- parts: electronics/dimensions.md -----------------------------------------
TX = (5.0, 5.8, 1.0, 8.7)                 # TSAL6200: body Ø, flange Ø, flange t, dome tip -> flange underside
RX = (3.0, 3.9, 0.6, 4.5)                 # TEFT4300, same fields
# Perfboard coordinates: x from the USB-C short edge (faces downstream), y from the header long edge (faces the gate).
BOARD = (30.0, 70.0, 1.6)                 # w (y), l (x), t
BOARD_HOLE_X, BOARD_HOLE_Y = (28.5, 66.5), (3.5, 26.5)   # 4 x Ø3.2; none at the USB end (the XIAO sits there)
BOARD_UNDER = 3.5                         # keep-out below the board: pins/leads trimmed <= 2 + underside wires (electronics)
END_RAIL_X = (0.5, 4.0)                   # joint-free strip at the USB end (column 0 is at x 5.8): the board's end support
EDGE = 1.5                                # joint-free strip along both long edges: ledges under every lip and clip
HEADER_X = (32.0, 53.0)                   # J_PT/J_LED/J_BAT row on the header edge (y 3.4); Dupont plugs stand above it
PLUG_H = 22.0                             # Dupont housing 14 + header spacer 2.5 + wire bend ~5
SPLICE_D = 2.4                            # soldered lead-to-jumper splice under heat-shrink, sits in the well's lead slot
USB_Y, USB_Z, USB_PROTRUDE = 16.1, 5.7, -1.4  # port centre from the header edge / above board top; face past the edge (- = inside)
CAL_X, CAL_Y = (54.0, 62.0), 24.0         # calibration-resistor sockets near the socket edge (gate side), reached through the lid
BAT = (17.0, 68.0, 47.0)                  # DFRobot FIT0610 stood on its long edge: thickness, length, height (2487 needs ribs scraped)
POCKET = (50.0, 9.5, 8.0)                 # JST-PH pocket beside the tunnel mouth (y, u, z): mated pair + the board-side loop
JST_LOOP = 45.0                           # board-side lead slack tucked in the pocket: the pair pulls out past the face
JST = (22.0, 7.5, 7.0)                    # mated JST-PH pair envelope incl. lead entries (electronics/dimensions.md)
LEAD_GAP = 4.0                            # holder lead end to hatch: the leads turn into the pocket here
TAB = (4.0, 6.0)                          # hatch pull lip: proud of the face, tall; sits above any ball
USB_PLUG = (12.5, 7.5)                    # largest USB-C overmould that fits the opening (w, h)
USB_STRAIGHT, USB_RA = 40.0, 25.0         # straight plug + strain relief / right-angle plug body, out of the face
RIB = (1.0, 0.15)                         # crush ribs on the hatch edge: Ø, interference (friction fit, no magnets)
CLIP_X, LIP_X = (24.0, 57.0), (18.0, 45.0)
DETENT_X = (57.0,)                        # clips with no room to reach: 45 deg hook underside, pops off when the board edge is lifted (~7 N)   # board x of the snap clips (header edge, clear of the headers at 33-52 and the V-wall) / fixed lips (outer-wall edge)
PIN_X = 66.5                              # board x of the 2 locating pins + bosses (the only holes used)
CLIP_T, HOOK = 1.2, 0.4                   # snap beam thickness, hook overhang: <= 2 % strain (review S1)
LIP_HOOK = 0.4                            # wall-side detent overhang: the board drops straight in, pushing the gate clips aside (review B12)
CLIP_ROOT = 1.5                           # beam root above the bottom face: a 0.6 skin would peel (review)
CLR = 0.4                                 # fit clearance for pockets

# ---- derived ----------------------------------------------------------------
IW = DRAWER_W - 2 * SIDE_GAP
S = (IW - CH_W) / 2                       # each side region's width at the gate
_A = math.radians(FUNNEL_DEG)
LF = S / math.tan(_A)                     # V-wall length along y
CH_H = H_BODY - ROOF_T
WALL_OFF = WALL / math.cos(_A)            # inner offset of the V-wall, measured in u
BOSS_H = 7.0                              # board underside above the floor: room for joints and a 10+ mm clip beam
WALL_ROT = 90 - FUNNEL_DEG                # V-wall direction vs the u axis


def P(s, d):                              # (s, d) along/off the V-wall -> (u, y)
    return (s * math.sin(_A) - d * math.cos(_A), s * math.cos(_A) + d * math.sin(_A))


L = LF + STRAP_W + 4                      # the strap band is the last STRAP_W of the insert
INSERT_Y0 = DRAWER_L - BALL_STORE - L    # drawer y of the V-wall tips (insert pushed to BALL_STORE from the end wall)
Y_R = max(0.0, ENTRANCE_END_Y + ENTRANCE_ERR - BALL_D / 2 + RAMP_MARGIN - INSERT_Y0)   # insert y where the ramps end
BAND_Y0 = L - STRAP_W
BEAM_Y = L - STRAP_W / 2                  # beam under the strap band: the band covers both wells and the wires
LEAD_SLOT, LEAD_SLOT_W = 5.0, 3.6         # well behind the flange where the leads turn up; wide enough for the splices (review B3)
BLOCK = RX_RECESS + RX[3] + RX[2] + 0.3 + LEAD_SLOT + 1.5   # solid block around the receiver in the hollow bay
OUT = Path(__file__).parent / "out"


def box(u0, u1, y0, y1, z0, z1):
    return Pos(u0, y0, z0) * Box(u1 - u0, y1 - y0, z1 - z0, align=(Align.MIN,) * 3)


def rect(u0, u1, y0, y1):
    return Pos(u0, y0) * Rectangle(u1 - u0, y1 - y0, align=(Align.MIN, Align.MIN))


def xcyl(u0, u1, y, z, d):                # cylinder along u
    return Pos((u0 + u1) / 2, y, z) * Rot(0, 90, 0) * Cylinder(d / 2, u1 - u0)


def ycyl(u, y0, y1, z, d):                # cylinder along y
    return Pos(u, (y0 + y1) / 2, z) * Rot(90, 0, 0) * Cylinder(d / 2, y1 - y0)


def zcyl(u, y, z0, z1, d):
    return Pos(u, y, z0) * Cylinder(d / 2, z1 - z0, align=(Align.CENTER, Align.CENTER, Align.MIN))


def to_right(shape):                      # u-space -> right side of the drawer
    return Pos(IW, 0, 0) * mirror(shape, about=Plane.YZ)


def beam_well(el, recess):
    """Top-loading well for a round LED/phototransistor lying along u, tip toward the channel.

    Body slot in front of the flange, flange slot, then a narrow lead slot behind it: the flange is held
    between two shoulders, so wire pull can't drag the element back. Leads sit one above the other.
    """
    body_d, fl_d, fl_t, tip_fl = el
    u_tip = S - recess
    u_fl = u_tip - tip_fl                 # flange underside (front face)
    u_back = u_fl - fl_t - 0.3
    top = H_BODY + 1
    well = box(u_fl, u_tip + 0.2, BEAM_Y - body_d / 2 - 0.1, BEAM_Y + body_d / 2 + 0.1, BEAM_Z - body_d / 2 - 0.1, top)
    well += box(u_back, u_fl, BEAM_Y - fl_d / 2 - 0.15, BEAM_Y + fl_d / 2 + 0.15, BEAM_Z - fl_d / 2 - 0.15, top)
    well += box(u_back - LEAD_SLOT, u_back, BEAM_Y - 0.7, BEAM_Y + 0.7, BEAM_Z - 2.0, top)   # narrow: flange's back shoulder
    well += box(u_back - LEAD_SLOT, u_back, BEAM_Y - LEAD_SLOT_W / 2, BEAM_Y + LEAD_SLOT_W / 2, BEAM_Z + 3, top)
    return well + xcyl(u_tip - 0.5, S + 1, BEAM_Y, BEAM_Z, APERTURE_D)


region = Polygon((0, 0), (S, LF), (S, L), (0, L), align=None)   # one side region, behind its V-wall
interior = offset(region, -WALL, kind=Kind.INTERSECTION) & rect(-1, S + 1, Y_R + WALL, L + 1)   # hollow bay
ramp_cut = (Location((*P(-100, 0), RAMP_EDGE_H), (0, 0, WALL_ROT)) * Rot(RAMP_DEG, 0, 0)
            * Box(500, 200, 200, align=(Align.MIN,) * 3)) & box(-1, S + 1, -1, Y_R, 0, H_BODY + 1)
gy0, gy1 = BEAM_Y - GROOVE_W / 2, BEAM_Y + GROOVE_W / 2
groove_z = H_BODY - GROOVE_D

# ---- left side: hollow electronics bay, receiver, perfboard --------------------
rx_block = box(S - BLOCK, S, BEAM_Y - 8, BEAM_Y + 8, 0, H_BODY)
board_u0 = WALL + 0.2                     # outer-wall side; the header edge (board y = 0) is at board_u0 + BOARD[0]
board_y1 = L - WALL - max(USB_PROTRUDE, 0) - 0.2   # USB-C end of the board, against the downstream wall
board_y0 = board_y1 - BOARD[1]
board_top = FLOOR + BOSS_H + BOARD[2]


def on_board(x, y):                       # perfboard (x, y) -> (u, y_insert); a ROTATION (components up, review B11):
    return board_u0 + y, board_y1 - x       # USB end downstream, header edge (y=0) on the outer wall, socket edge to the gate


pin_holes = [on_board(PIN_X, y) for y in BOARD_HOLE_Y]   # both get a support boss
pin_locs = [on_board(PIN_X, 26.5)]                       # only the clip-side (gate) hole gets a pin: the board rolls in under the lips (review B8)
u_e = board_u0 + BOARD[0]                 # header edge (board y = 0)
u_w = board_u0                            # outer-wall edge (board y = 30)

left = extrude(region, H_BODY) - Pos(0, 0, FLOOR) * extrude(interior, H_BODY)
left += rx_block
# Supports only on joint-free areas (review B4): an end rail at the USB end, bosses at the 2 pin holes,
# and edge ledges under every lip and clip so the clamping force has something to press against.
left += box(u_w, u_e, board_y1 - END_RAIL_X[1], board_y1 - END_RAIL_X[0], FLOOR - 0.5, FLOOR + BOSS_H)
left += [zcyl(u, y, FLOOR - 0.5, FLOOR + BOSS_H, 7) for u, y in pin_holes]
left += [zcyl(u, y, FLOOR + BOSS_H, FLOOR + BOSS_H + 1.2, 2.8) for u, y in pin_locs]    # locating pin
for x in LIP_X:
    left += box(u_w, u_w + EDGE, board_y1 - x - 5, board_y1 - x + 5, FLOOR - 0.5, FLOOR + BOSS_H)
for x in CLIP_X:
    left += box(u_e - EDGE, u_e, board_y1 - x - 3, board_y1 - x + 3, FLOOR - 0.5, FLOOR + BOSS_H)
# Retention without screws: fixed lips on the outer-wall edge, snap clips on the header edge, each with a
# 0.4 mm crush bump so the board is clamped whatever its real thickness (review S2).
for x in LIP_X:
    yc = board_y1 - x
    # detent: flat underside holds the edge, 45 deg top lets the board push past on a straight drop
    left += Pos(0, yc - 5, 0) * extrude(Plane.XZ * Polygon(
        (WALL - 0.5, board_top + 0.3), (u_w + LIP_HOOK, board_top + 0.3), (u_w + LIP_HOOK, board_top + 0.6),
        (WALL - 0.5, board_top + 0.6 + (u_w + LIP_HOOK - WALL + 0.5)), align=None), 10, dir=(0, 1, 0))
    left += box(u_w + 0.05, u_w + LIP_HOOK - 0.05, yc - 1, yc + 1, board_top - 0.25, board_top + 0.3)   # crush bump
for x in CLIP_X:
    yc = board_y1 - x
    # beam rooted in a floor pocket for a 10 mm free length (review S1), rising to a release tab (review S7)
    left -= box(u_e + 0.2 - 0.6, u_e + 0.2 + CLIP_T + 1.2, yc - 3.6, yc + 3.6, CLIP_ROOT, FLOOR + 0.1)   # room for the flex
    left += box(u_e + 0.2, u_e + 0.2 + CLIP_T, yc - 3, yc + 3, CLIP_ROOT, H_BODY - 10)
    if x in DETENT_X:                     # 45 deg underside through the board's top corner (0.1 preload): a detent
        hook = Polygon((u_e + 0.2, board_top - 0.3), (u_e - HOOK, board_top + 0.5), (u_e + 0.2, board_top + 2.3), align=None)
    else:
        hook = Polygon((u_e + 0.2, board_top + 0.3), (u_e - HOOK, board_top + 0.3), (u_e + 0.2, board_top + 2.3), align=None)
        left += box(u_e - HOOK + 0.1, u_e - 0.1, yc - 1, yc + 1, board_top - 0.25, board_top + 0.3)   # crush bump
    left += Pos(0, yc - 3, 0) * extrude(Plane.XZ * hook, 6, dir=(0, 1, 0))
# the board's upstream header-edge corner reaches 0.6 mm past the V-wall's inner face: relieve the wall there
# (V-wall material only, so the supports stay), keeping >= 2 mm on the ball side (self-check)
# relief runs to the top: the board drops straight in (review B12)
board_relief = box(S / 2, u_e + 0.2, board_y0 - 0.2, board_y1, FLOOR, H_BODY + 1) \
    & (extrude(region, H_BODY) - Pos(0, 0, FLOOR) * extrude(offset(region, -WALL, kind=Kind.INTERSECTION), H_BODY))
left -= board_relief
left -= beam_well(RX, RX_RECESS)
left -= box(S - BLOCK - 1, S, gy0, gy1, groove_z, H_BODY + 1)                    # receiver leads into the bay
usb_u, usb_z = on_board(0, USB_Y)[0], board_top + USB_Z
left -= box(usb_u - 6.5, usb_u + 6.5, L - WALL - 1, L + 1, usb_z - 4, usb_z + 4)  # USB-C plug opening
left -= ramp_cut

# ---- right side: solid; battery holder in a tunnel along y, out through the downstream face -------------
# User: swap the cells from the collection end, not the top. The holder (leads at its downstream end) slides
# straight out onto the free floor; a friction-fit hatch closes the tunnel mouth flush with the face. The JST
# disconnect parks in a pocket beside the mouth with a loop of board-side lead, so it pulls out past the face
# to unplug; that lead leaves the pocket's back end up a channel to the top groove.
SLOT_U0, SLOT_Z0 = 2.5, 0.0               # open-bottom tunnel: the holder slides on the drawer floor, no edge to tip over (review S12)
SLOT_U1, SLOT_Z1 = SLOT_U0 + BAT[0] + 2 * CLR, SLOT_Z0 + BAT[2] + 2 * CLR
REBATE_Y = L - LID_T                      # hatch inner face (hatch as thick as the lid)
SLOT_Y0 = REBATE_Y - LEAD_GAP - BAT[1]    # tunnel back wall = the holder's home stop
PK_U0, PK_U1, PK_Z1 = SLOT_U1 + 1.2, SLOT_U1 + 1.2 + POCKET[1], SLOT_Z0 + POCKET[2]
PK_Y0 = REBATE_Y - POCKET[0]
JST_Y1 = REBATE_Y - LEAD_GAP               # parked pair's holder-lead end: room for the lead's U-turn (review S13)
bat_gu = PK_U0 + 2.5                      # lead channel / battery groove centre
HU0, HU1, HZ0, HZ1 = SLOT_U0 - 1.5, PK_U1 + 1.5, SLOT_Z0, SLOT_Z1 + 1.5   # hatch outline: 1.5 mm ledge on 3 sides, floor below
holder = box(SLOT_U0 + CLR, SLOT_U1 - CLR, SLOT_Y0, SLOT_Y0 + BAT[1], SLOT_Z0, SLOT_Z0 + BAT[2])   # home pose (u-space)

right = extrude(region, H_BODY)
right -= box(SLOT_U0, SLOT_U1, SLOT_Y0, L + 1, SLOT_Z0, SLOT_Z1)                   # holder tunnel, open at the face
right -= box(SLOT_U1 - 0.1, PK_U1, REBATE_Y - LEAD_GAP, L + 1, SLOT_Z0, PK_Z1)      # lead gap -> pocket
right -= box(PK_U0, PK_U1, PK_Y0, L + 1, SLOT_Z0, PK_Z1)                           # JST pocket
right -= box(bat_gu - 2, bat_gu + 2, PK_Y0, PK_Y0 + 4, SLOT_Z0, H_BODY + 1)        # lead channel up to the groove
right -= Pos(bat_gu, PK_Y0 + 4, PK_Z1) * Rot(45, 0, 0) * Box(4, 4.2, 4.2)           # 45 deg chamfer where the lead bends
for u in (SLOT_U0, SLOT_U1):                                                         # 1 x 45 deg lead-in at the mouth (review N8)
    right -= Pos(u, REBATE_Y, (SLOT_Z0 + SLOT_Z1) / 2) * Rot(0, 0, 45) * Box(1.42, 1.42, SLOT_Z1 - SLOT_Z0)
right -= Pos((SLOT_U0 + SLOT_U1) / 2, REBATE_Y, SLOT_Z1) * Rot(45, 0, 0) * Box(SLOT_U1 - SLOT_U0, 1.42, 1.42)
right -= box(HU0 - CLR / 2, HU1 + CLR / 2, REBATE_Y, L + 1, HZ0 - CLR / 2, HZ1 + CLR / 2)   # hatch rebate
for y in (SLOT_Y0 + 12, SLOT_Y0 + BAT[1] - 12):   # crush ribs on both long faces: round toward the slide (review S5)
    for u in (SLOT_U0 + CLR + RIB[1] - RIB[0] / 2, SLOT_U1 - CLR - RIB[1] + RIB[0] / 2):
        right += zcyl(u, y, SLOT_Z0, SLOT_Z1, RIB[0])
right -= beam_well(TX, TX_RECESS)
right -= box(bat_gu - GROOVE_W / 2, bat_gu + GROOVE_W / 2, PK_Y0, gy1, groove_z, H_BODY + 1)   # battery lead
right -= box(bat_gu - GROOVE_W / 2, S + 1, gy0, gy1, groove_z, H_BODY + 1)
right -= ramp_cut

roof = box(S - 1, IW - S + 1, BAND_Y0, L, CH_H, H_BODY) - box(S - 2, IW - S + 2, gy0, gy1, groove_z, H_BODY + 1)
body = left + to_right(right) + roof

# ---- lids --------------------------------------------------------------------
lip_outer = offset(interior, -CLR / 2, kind=Kind.INTERSECTION)
lip = extrude(lip_outer - offset(lip_outer, -1.6, kind=Kind.INTERSECTION), 4) \
    - box(S - BLOCK - 0.5, S, BEAM_Y - 8.5, BEAM_Y + 8.5, -1, 5)
left_lid = Pos(0, 0, H_BODY) * extrude(region & rect(-1, S + 1, Y_R, L + 1), LID_T) + Pos(0, 0, H_BODY - 4) * lip
for e in lip_outer.edges():               # crush ribs on the lip's outer face: the lid can't lift and buzz (review S3)
    if e.length < 25:
        continue
    for t in (0.25, 0.75):
        pt, tg = e.position_at(t), e.tangent_at(t)
        if S - BLOCK - 1 <= pt.X and abs(pt.Y - BEAM_Y) <= 9.5:
            continue                      # the lip is cut away around the receiver block here
        nrm = (-tg.Y, tg.X)
        c = lip_outer.center()
        if (pt.X + nrm[0] - c.X) ** 2 + (pt.Y + nrm[1] - c.Y) ** 2 < (pt.X - c.X) ** 2 + (pt.Y - c.Y) ** 2:
            nrm = (-nrm[0], -nrm[1])      # make it point outward
        k = RIB[0] / 2 - CLR / 2 - RIB[1]
        left_lid += zcyl(pt.X - nrm[0] * k, pt.Y - nrm[1] * k, H_BODY - 4, H_BODY, RIB[0])
left_lid -= box(on_board(0, CAL_Y)[0] - 6, on_board(0, CAL_Y)[0] + 6, board_y1 - CAL_X[1] - 2, board_y1 - CAL_X[0] + 2,
                H_BODY - 5, H_BODY + LID_T + 1)                                  # calibration resistors
hatch = box(HU0, HU1, REBATE_Y, L, HZ0, HZ1)    # flush plug: balls can only push it onto its ledge
hatch += box((HU0 + HU1) / 2 - 8, (HU0 + HU1) / 2 + 8, L, L + TAB[0], HZ1 - TAB[1], HZ1)   # pull lip, above ball height
k = RIB[0] / 2 - CLR / 2 - RIB[1]         # crush ribs along the pull direction, pressing into the rebate walls
for z in (HZ0 + 8, HZ1 - 8):
    hatch += [ycyl(u, REBATE_Y, L, z, RIB[0]) for u in (HU0 + k, HU1 - k)]
hatch += [ycyl(u, REBATE_Y, L, HZ1 - k, RIB[0]) for u in (HU0 + 6, HU1 - 6)]   # none at the bottom: it's the floor
hatch = to_right(hatch)


def filament_g(shape, walls=1.26, infill=0.15, density=1.27):
    """PETG estimate for 3 x 0.42 mm walls + 15 % infill; Bambu Studio's number is the real one."""
    shell = min(shape.area * walls, shape.volume)
    return density * (shell + (shape.volume - shell) * infill) / 1000


def self_check():
    """Runnable check of the geometry the ball and the parts depend on. Fails loudly."""
    r = BALL_D / 2
    # ponytail: quasi-static wall-slide model (gravity along the V-wall vs wall friction + rolling
    # resistance); ignores spin and impact. Calibrate with a real ball on the real drawer.
    stall_margin = math.tan(math.radians(DRAWER_SLOPE_DEG)) * (math.cos(_A) - WALL_MU * math.sin(_A)) / ROLL_RES
    assert CH_W >= BALL_D + 4, "channel too tight: ball can rub both walls"
    assert CH_H >= BALL_D + 8, "tunnel too low"
    assert abs(BEAM_Z - r) < r * 0.3, "beam far from the ball centre"
    assert SIDE_GAP < r * (1 - math.cos(_A)), "ball rolling along the drawer wall would catch the V-wall tip"
    assert RAMP_EDGE_H > r + 3, "V-wall under the entrance too low to turn a rolling ball"
    assert stall_margin > 1.0, f"model says a slow ball stalls on the V-wall (margin {stall_margin:.2f})"
    board = rect(board_u0, board_u0 + BOARD[0], board_y0, board_y1 + max(USB_PROTRUDE, 0))
    assert ((board_y0 - 0.2) * math.tan(_A) - (u_e + 0.2)) * math.cos(_A) >= 2.0, "board relief leaves < 2 mm of V-wall"
    # ---- keep-outs: wires, plugs and joints must never share space with plastic (review; lead) ----
    clear = lambda solid, name: (lambda h: not h.solids() or h.volume < 0.05)(solid & body)   # noqa: E731
    bz = FLOOR + BOSS_H                   # board underside
    under = box(u_w + EDGE, u_e - EDGE, board_y0, board_y1 - END_RAIL_X[1], bz - BOARD_UNDER, bz)
    under -= [zcyl(u, y, bz - 5, bz + 1, 7.2) for u, y in pin_holes]
    assert clear(under, ""), "plastic in the solder-joint/wire space under the board"
    above = box(u_w + EDGE, u_e - EDGE, board_y0, board_y1, board_top, board_top + 14)
    assert clear(above, "") and not (above & left_lid).solids(), "plastic in the 14 mm component space above the board"
    plugs = box(on_board(0, 1.5)[0], on_board(0, 6.0)[0], board_y1 - HEADER_X[1], board_y1 - HEADER_X[0], board_top, board_top + PLUG_H)
    (x0, y0), (x1, y1), (x2, y2) = on_board(0, 0), on_board(1, 0), on_board(0, 1)
    assert (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0) > 0, "perfboard placed as a mirror image (component side down)"
    assert clear(plugs, "") and not (plugs & left_lid).solids(), "Dupont plugs on the header row hit plastic"
    for el, rec, side in ((RX, RX_RECESS, left), (TX, TX_RECESS, right)):
        u_back = S - rec - el[3] - el[2] - 0.3
        splice = zcyl(u_back - LEAD_SLOT / 2, BEAM_Y, BEAM_Z + 4, BEAM_Z + 16, SPLICE_D)
        h = splice & side
        assert not h.solids() or h.volume < 0.05, "lead splice doesn't fit its well"
    strain = 1.5 * CLIP_T * (HOOK + LIP_HOOK + 0.2) / (board_top + 0.3 - CLIP_ROOT) ** 2   # own hook + board shift past the detents
    assert strain <= 0.02, f"snap clip strain {strain:.1%} > 2 % (PETG, repeated)"
    for x in CLIP_X:                      # each clip's 1.0 mm deflection sweep must be free of plastic
        yc = board_y1 - x
        sweep = box(u_e + 0.2 + CLIP_T + 0.05, u_e + 0.2 + CLIP_T + HOOK + LIP_HOOK + 0.3, yc - 3, yc + 3, CLIP_ROOT + 0.1, H_BODY - 10)
        assert clear(sweep, ""), f"snap clip at board x={x} can't flex (plastic in its sweep)"
    # ---- battery from the end face (user 2026-10-15): straight out along +y onto the free floor, no top access ----
    free = lambda solid: (lambda h: not h.solids() or h.volume < 0.05)(solid & right)   # noqa: E731  (u-space)
    hh = holder & right
    assert hh.solids() and hh.volume < 30, "holder must touch only the crush ribs"
    slide = box(SLOT_U0 + CLR + RIB[1] + 0.01, SLOT_U1 - CLR - RIB[1] - 0.01, SLOT_Y0, L + BAT[1] + 1,
                SLOT_Z0 + 0.01, SLOT_Z0 + BAT[2])
    assert free(slide), "holder can't slide straight out of the downstream face"
    assert BALL_STORE >= BAT[1] + 3, "free floor too short: the holder can't come fully out of its tunnel"
    assert SLOT_Y0 - 2 >= Y_R, "holder tunnel reaches under the ramps"
    assert SLOT_U0 >= 2.0 and HU0 - CLR / 2 >= 0.75, "holder tunnel / hatch rebate breaks the outer face"
    jst = box(PK_U0 + 0.5, PK_U0 + 0.5 + JST[1], JST_Y1 - JST[0], JST_Y1, SLOT_Z0 + 0.2, SLOT_Z0 + 0.2 + JST[2])
    assert REBATE_Y - JST_Y1 >= 4, "no room for the holder lead's U-turn between the JST pair and the hatch"
    assert L + 10 - (JST_Y1 - JST[0]) <= JST_LOOP, "board-side loop too short to pull the JST pair 10 mm past the face"
    assert free(box(PK_U0 + 0.5, PK_U1 - 0.5, PK_Y0 + 4.5, JST_Y1 - JST[0], SLOT_Z0 + 0.2, PK_Z1 - 0.2)), "no room for the lead loop"
    assert free(jst), "JST-PH mated pair (22 x 7.5 x 7 envelope) doesn't fit its pocket"
    assert free(box(PK_U0 + 0.5, PK_U0 + 0.5 + JST[1], JST_Y1 - JST[0], L + 40, SLOT_Z0 + 0.2, SLOT_Z0 + 0.2 + JST[2])), \
        "JST-PH pair can't be pulled straight out past the face"
    assert free(box(bat_gu - 1.7, bat_gu + 1.7, PK_Y0 + 0.3, PK_Y0 + 3.7, SLOT_Z0 + 0.3, H_BODY + 1)), "battery lead channel blocked"
    assert free(box(bat_gu - 2.7, bat_gu + 2.7, PK_Y0 + 0.3, gy1 - 0.3, groove_z + 0.1, H_BODY + 1)), "battery groove blocked"
    hv = hatch & body
    assert hv.solids() and hv.volume < 3, "hatch must touch its rebate only with the crush ribs"
    assert (Pos(0, -0.5, 0) * hatch & body).volume > 20, "no ledge behind the hatch: a ball could push it in"
    assert HZ1 - TAB[1] >= BALL_D + 3, "hatch pull lip low enough for a ball to hit it"
    assert body.bounding_box().max.Y <= L + 1e-6, "body protrudes past the downstream face"
    assert r - math.sqrt(r * r - 6.5 ** 2) < 1.5, "a ball can dip into the 13 mm USB opening"
    # ---- USB-C from the end face: the largest overmould fits the opening; straight and right-angle plugs fit the free floor
    usb_plug = box(usb_u - USB_PLUG[0] / 2, usb_u + USB_PLUG[0] / 2, board_y1 + USB_PROTRUDE, L + USB_STRAIGHT,
                   usb_z - USB_PLUG[1] / 2, usb_z + USB_PLUG[1] / 2)
    assert clear(usb_plug, ""), "USB-C overmould doesn't fit the opening"
    assert USB_STRAIGHT + 15 <= BALL_STORE and USB_RA + 10 <= BALL_STORE, "no room for a USB-C cable in front of the face"
    assert (board & rect(S - BLOCK - 2, S, BEAM_Y - 8, BEAM_Y + 8)).area < 1e-3, "perfboard hits the receiver block"
    assert H_BODY - board_top >= 15 + LID_T, "no 15 mm above the board for the Dupont plugs"
    ue = board_u0 + BOARD[0]
    for x in CLIP_X:   # each snap hook must overhang the board's header edge
        assert (body & box(ue - 0.5, ue - 0.3, board_y1 - x - 0.1, board_y1 - x + 0.1,
                           board_top + 0.3, board_top + 0.5)).solids(), "snap clip hook missing"
    for x in LIP_X:
        assert (body & box(board_u0 + 0.1, board_u0 + 0.3, board_y1 - x - 0.1, board_y1 - x + 0.1,
                           board_top + 0.3, board_top + 0.5)).solids(), "wall lip missing"
    assert Y_R < LF - 10, "the entrance reaches the gate: no room for the ramps"
    assert INSERT_Y0 >= 0, "insert longer than the drawer"
    assert H_BODY + LID_T <= DRAWER_H - 10, "insert too tall for the drawer"
    bb = body.bounding_box()
    assert max(bb.size.X, bb.size.Y, bb.size.Z) <= 256, "part exceeds the printer"
    assert body.is_valid and left_lid.is_valid and hatch.is_valid
    print(f"insert {bb.size.X:.0f} x {bb.size.Y:.0f} x {H_BODY + LID_T:.0f} mm; V-walls {LF:.0f} mm long at {FUNNEL_DEG:.0f} deg")
    print(f"stall margin {stall_margin:.2f} at {DRAWER_SLOPE_DEG} deg floor (bare floor "
          f"{math.tan(math.radians(DRAWER_SLOPE_DEG)) / ROLL_RES:.2f}; < 1 stalls, >= 1.5 wanted)")
    if stall_margin < 1.5:
        print("WARNING: thin stall margin; roll-test a ball along a wall at FUNNEL_DEG in the real drawer", file=sys.stderr)
    print(f"in a {DRAWER_L:.0f} mm drawer: V-wall tips {INSERT_Y0:.0f} mm from the upstream end, insert end "
          f"{BALL_STORE:.0f} mm from the end wall; ramps cover the first {Y_R:.0f} mm "
          f"(entrance end {ENTRANCE_END_Y:.0f} +/- {ENTRANCE_ERR:.0f})")
    j_bat = on_board(sum(HEADER_X) / 2, 3.4)
    lead = (JST_Y1 - JST[0] - PK_Y0 + JST_LOOP + H_BODY - SLOT_Z0 + BEAM_Y - PK_Y0 + IW - bat_gu - j_bat[0]
            + H_BODY - board_top + BEAM_Y - j_bat[1] + 20)   # pocket + loop, up, groove, across, down, to J_BAT, slack
    print(f"battery: holder slides {L - SLOT_Y0:.1f} mm to clear the face, then sits {BALL_STORE - BAT[1]:.0f} mm from the "
          f"end wall; board-side lead >= {lead:.0f} mm (J_BAT to the JST-PH, incl. the {JST_LOOP:.0f} mm loop)")
    print("PETG estimate: " + ", ".join(f"{n} {filament_g(s):.0f} g" for n, (s, _) in PARTS.items()))


# ---- renders (review only) ---------------------------------------------------
def components():
    """Placeholder bodies for the renders (not printed)."""
    from build123d import Sphere
    ball = lambda u, y: Pos(u, y, BALL_D / 2) * Sphere(BALL_D / 2)   # noqa: E731
    balls = [ball(IW / 2 + 12, Y_R * 0.4), ball(IW / 2 - 15, LF * 0.75), ball(IW / 2, BEAM_Y)]
    tx_u, rx_u = S - TX_RECESS - TX[3], S - RX_RECESS - RX[3]
    elec = [to_right(xcyl(tx_u, tx_u + TX[3], BEAM_Y, BEAM_Z, TX[0])), xcyl(rx_u, rx_u + RX[3], BEAM_Y, BEAM_Z, RX[0]),
            box(board_u0, board_u0 + BOARD[0], board_y0, board_y1, board_top - BOARD[2], board_top),
            box(usb_u - 8.9, usb_u + 8.9, board_y1 - 21 + USB_PROTRUDE, board_y1 + USB_PROTRUDE,
                board_top + 2.5, board_top + 4.1)]                                  # XIAO on its headers
    return balls, elec, to_right(holder)


def service():
    """Placeholders for the end-face renders: JST pair in its pocket, USB-C plug (straight), as (home, pulled)."""
    jst = to_right(box(PK_U0 + 0.5, PK_U0 + 8.0, JST_Y1 - JST[0], JST_Y1, SLOT_Z0 + 0.2, SLOT_Z0 + 5.7))
    usb = box(usb_u - 6, usb_u + 6, board_y1 + USB_PROTRUDE, L + 30, usb_z - 3.25, usb_z + 3.25) \
        + ycyl(usb_u, L + 30, L + BALL_STORE - 5, usb_z, 4)
    return jst, usb


def drawer_lines():
    """Wireframe of the drawer in the insert frame, plus a marker where the entrance opening ends."""
    x0, x1, ya, yb, h = -SIDE_GAP, IW + SIDE_GAP, -INSERT_Y0, DRAWER_L - INSERT_Y0, DRAWER_H
    c = [(x0, ya), (x1, ya), (x1, yb), (x0, yb)]
    segs = [((*c[i], 0), (*c[(i + 1) % 4], 0)) for i in range(4)]
    segs += [((*p, 0), (*p, h)) for p in c] + [((*c[i], h), (*c[(i + 1) % 4], h)) for i in (1, 3)]
    ye = ENTRANCE_END_Y - INSERT_Y0
    segs += [((x0, ye, h), (x0, ye, 0)), ((x0, ye, 0), (x1, ye, 0)), ((x1, ye, 0), (x1, ye, h))]
    return segs


def render_all():
    balls, elec, bat = components()
    dark, lid_c, hatch_c, comp_c, bat_c, ball_c = "#5b6478", "#8fa1b3", "#d08770", "#5e81ac", "#ebcb8b", "#eceff4"
    up = Pos(0, 0, 25)
    render(OUT / "assembly.png", [(body, dark, 1), (up * left_lid, lid_c, 1), (Pos(0, 25, 0) * hatch, hatch_c, 1),
                                  (elec, comp_c, 1), (bat, bat_c, 1), (balls, ball_c, 1)], lines=drawer_lines(),
           title="In the drawer (lid lifted, hatch pulled 25 mm). Grey line on the floor: end of the goal-entrance opening")
    render(OUT / "assembly_closed.png", [(body, dark, 1), (left_lid, lid_c, 1), (hatch, hatch_c, 1), (balls, ball_c, 1)],
           title="Closed. Strap band = roof over the gate, wall to wall")
    render(OUT / "top.png", [(body, dark, 1), (elec, comp_c, 1), (bat, bat_c, 1), (balls, ball_c, 1)],
           view=(0, 0, 1), up=(0, 1, 0), title="Top view, lids off (ball travels up the page)")
    render(OUT / "gate.png", [(body, dark, 1), (elec, comp_c, 1), (balls[2], ball_c, 1)],
           view=(0, 1, 0.12), title="Gate seen from the collection end")
    render(OUT / "ramps.png", [(body, dark, 1), (left_lid, lid_c, 1), (hatch, hatch_c, 1), (balls, ball_c, 1)],
           view=(-0.2, -1, 0.35), title="From upstream: ramps under the entrance shed a dropped ball into the funnel")
    render(OUT / "preview.png", [(body, dark, 1), (left_lid, lid_c, 1), (hatch, hatch_c, 1), (balls[2], ball_c, 1)],
           lines=drawer_lines(), size=(800, 600))
    jst, usb = service()
    face = (0.45, 1, 0.4)
    render(OUT / "face.png", [(body, dark, 1), (left_lid, lid_c, 1), (hatch, hatch_c, 1), (usb, comp_c, 1),
                              (balls[2], ball_c, 1)], view=face,
           title="Seen from the collection end: battery hatch (left here), USB-C (right here), 73 mm free floor")
    render(OUT / "face_swap.png", [(body, dark, 1), (left_lid, lid_c, 1), (Pos(0, BALL_STORE + 20, 0) * hatch, hatch_c, 1),
                                   (Pos(0, 45, 0) * bat, bat_c, 1), (Pos(0, 30, 0) * jst, comp_c, 1)], view=face,
           lines=drawer_lines(),
           title="Battery swap: hatch off, JST pulled out and unplugged, holder slides straight out")
    colors = {"body": dark, "left_lid": lid_c, "battery_hatch": hatch_c}
    for name, (_, printable) in PARTS.items():
        render(OUT / f"part_{name}.png", [(printable, colors[name], 1)], title=f"{name} (print orientation)")


def render_video():
    """Untitled 1920x1440 stills on a transparent background, for the video agent."""
    balls, elec, bat = components()
    dark, lid_c, hatch_c, comp_c, bat_c, ball_c = "#5b6478", "#8fa1b3", "#d08770", "#5e81ac", "#ebcb8b", "#eceff4"
    d = OUT / "video"
    d.mkdir(exist_ok=True)
    kw = dict(size=(1920, 1440), transparent=True)
    up = Pos(0, 0, 25)
    render(d / "1_closed.png", [(body, dark, 1), (left_lid, lid_c, 1), (hatch, hatch_c, 1), (balls[2], ball_c, 1)],
           lines=drawer_lines(), **kw)
    render(d / "2_open.png", [(body, dark, 1), (up * left_lid, lid_c, 1), (up * hatch, hatch_c, 1),
                              (elec, comp_c, 1), (bat, bat_c, 1), (balls[2], ball_c, 1)], lines=drawer_lines(), **kw)
    render(d / "3_gate.png", [(body, dark, 1), (left_lid, lid_c, 1), (hatch, hatch_c, 1), (balls[2], ball_c, 1)],
           view=(0, 1, 0.12), **kw)
    render(d / "4_top.png", [(body, dark, 1), (left_lid, lid_c, 1), (hatch, hatch_c, 1), (balls, ball_c, 1)],
           view=(0, 0, 1), up=(0, 1, 0), **kw)
    jst, _ = service()
    render(d / "5_battery_swap.png", [(body, dark, 1), (left_lid, lid_c, 1), (Pos(0, BALL_STORE + 20, 0) * hatch, hatch_c, 1),
                                      (Pos(0, 45, 0) * bat, bat_c, 1), (Pos(0, 30, 0) * jst, comp_c, 1)],
           view=(0.45, 1, 0.4), **kw)


PARTS = {   # name: (shape, print orientation)
    "body": (body, body),
    "left_lid": (left_lid, Rot(180, 0, 0) * left_lid),
    "battery_hatch": (hatch, Rot(90, 0, 0) * hatch),   # inner face on the bed, lip up
}

if __name__ == "__main__":
    self_check()
    if "--check" in sys.argv:
        sys.exit()
    OUT.mkdir(exist_ok=True)
    for name, (shape, printable) in PARTS.items():
        bb = printable.bounding_box()
        printable = Pos(-bb.min.X, -bb.min.Y, -bb.min.Z) * printable    # on the bed
        PARTS[name] = (shape, printable)
        export_stl(printable, str(OUT / f"{name}.stl"))
        m = Mesher()
        m.add_shape(printable)
        m.write(str(OUT / f"{name}.3mf"))
    print("exported:", ", ".join(f"out/{n}.stl/.3mf" for n in PARTS))
    render_all()
    print("rendered: out/*.png")
    if "--video" in sys.argv:
        render_video()
        print("rendered: out/video/*.png")
