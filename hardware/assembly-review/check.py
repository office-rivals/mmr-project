"""Assembly-review gate: every part goes in, in guide order, along a real path, against the current models.

    cd hardware/mechanical && uv run python ../assembly-review/check.py [insert|sled|scoreboard]

Prints PASS/FAIL per step and exits 1 on any FAIL. Read-only: imports mechanical/insert.py, sled.py, scoreboard.py and
electronics/perfboard.py (the board layout is taken from there, so a layout change is checked too).

How a step is checked: the part is moved through a list of poses from outside to its final place. At every
pose its volume inside the obstacles (the shell, minus the declared flex zones, plus every part already
fitted) must stay under the step's tolerance. Flex zones are the parts meant to give way while fitting:
snap-clip beams and hooks, and crush bumps. Their own strain and sweep are mechanical's self-check.
"""
import math
import sys
from pathlib import Path

HW = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HW / "mechanical"))
from build123d import Align, Box, Cylinder, Location, Plane, Pos, Rot, Sphere, Vector, extrude  # noqa: E402

MINZ = (Align.CENTER, Align.CENTER, Align.MIN)
PLUG_H = 22.0             # Dupont: header spacer 2.5 + housing 14 + wire bend ~5
SOLDERED = ("J_EPD", "J_SND", "J_RFID", "J_LEDS", "J_AMP")   # solder points, wires straight in: 6 mm, no Dupont plug
SLOPE_MAX = 3.3           # steepest drawer floor tilt toward the collection end (user: 10-20 mm over 350)
RESULTS = []


def bx(x0, x1, y0, y1, z0, z1):
    return Pos(x0, y0, z0) * Box(x1 - x0, y1 - y0, z1 - z0, align=(Align.MIN,) * 3)


def vol(a, b):
    if a is None or b is None or not a.solids() or not b.solids():   # an empty shape (e.g. a cut that removed it all)
        return 0.0
    p, q = a.bounding_box(), b.bounding_box()
    if any(getattr(p.max, c) < getattr(q.min, c) or getattr(q.max, c) < getattr(p.min, c) for c in "XYZ"):
        return 0.0                                   # quick reject
    r = a & b
    return sum(s.volume for s in r.solids()) if r is not None and r.solids() else 0.0


def report(dev, step, ok, detail):
    RESULTS.append(ok)
    print(f"{'PASS' if ok else 'FAIL'}  {dev:10s} {step:28s} {detail}")


def path(dev, step, part, poses, obstacles, tol=0.5):
    """part: shape at its final pose; poses: Locations applied on top of it (last = identity); obstacles: [(name, shape)]."""
    for i, loc in enumerate(poses):
        moved = loc * part
        for name, ob in obstacles:
            v = vol(moved, ob)
            if v > tol:
                return report(dev, step, False, f"pose {i + 1}/{len(poses)}: {v:.1f} mm³ into {name}")
    report(dev, step, True, f"{len(poses)} poses clear")


def legs(*segs):
    """Path from outside to the final pose. segs, listed from the final pose outward: (direction, distance[, steps])."""
    way = [Vector(0, 0, 0)]
    for seg in segs:
        way.append(way[-1] + Vector(*seg[0]).normalized() * seg[1])
    poses = []
    for i in range(len(segs), 0, -1):         # walk inward: last waypoint -> ... -> final
        n = segs[i - 1][2] if len(segs[i - 1]) > 2 else 8
        a, b = way[i], way[i - 1]
        poses += [Pos(*(a + (b - a) * (k / n))) for k in range(n)]
    return poses + [Pos(0, 0, 0)]


def linear(direction, dist, n=8):
    return legs((direction, dist, n))


# ---- the real board, from electronics/perfboard.py ----------------------------------------------------------
def perfboard(sb):
    src = (HW / "electronics" / "perfboard.py").read_text().split("def board(")[0]
    argv, sys.argv = sys.argv, ["perfboard"] + (["--scoreboard"] if sb else [])
    ns = {}
    try:
        exec(src, ns)
    finally:
        sys.argv = argv
    return ns


def board_parts(sb, plugs):
    """Board in its own frame: x from the USB end, y from the header edge, z = 0 at the top face, parts up."""
    ns = perfboard(sb)
    xy = ns["xy"]
    slab = bx(0, 70, 0, 30, -1.6, 0) - [Pos(x, y, -3) * Cylinder(1.6, 6, align=MINZ) for x, y in ns["MOUNT"]]
    parts = [bx(2.9, 23.9, 16.1 - 8.9, 16.1 + 8.9, 0, 4.1),          # XIAO on its headers
             bx(1.4, 8.8, 16.1 - 4.5, 16.1 + 4.5, 4.1, 7.3)]          # its USB-C receptacle
    lx = [xy(*p)[0] for p in ns["LIS"].values()]
    ly = [xy(*p)[1] for p in ns["LIS"].values()]
    cx, cy = (min(lx) + max(lx)) / 2, (min(ly) + max(ly)) / 2
    parts.append(bx(cx - 11.43, cx + 11.43, cy - 6.35, cy + 6.35, 0, 5.3))   # LIS3DH on headers
    plug_cols = []
    for name, a, b, _ in ns["PARTS"]:
        (x0, y0), (x1, y1) = xy(*a), xy(*b)
        if name.startswith("C1"):
            parts.append(Pos((x0 + x1) / 2, (y0 + y1) / 2, 0) * Cylinder(4.0, 13.0, align=MINZ))
            continue
        h = (14.0 if name.startswith(("R_LED", "R_PU", "R_SND")) else 6.0 if name.startswith(SOLDERED) else 10.0 if name.startswith("R") else 6.0 if name.startswith("C2")
             else 3.0 if name.startswith("D1") else 8.5 if name.startswith("J_") else 10.0)
        box = bx(min(x0, x1) - 1.3, max(x0, x1) + 1.3, min(y0, y1) - 1.3, max(y0, y1) + 1.3, 0, h)
        parts.append(box)
        if name.startswith("J_") and not name.startswith(SOLDERED):
            plug_cols.append(bx(min(x0, x1) - 1.3, max(x0, x1) + 1.3, min(y0, y1) - 1.3, max(y0, y1) + 1.3, 0, PLUG_H))
    under = bx(4.5, 70, 1.5, 28.5, -1.6 - 3.0, -1.6) - [Pos(x, y, -10) * Cylinder(3.5, 20, align=MINZ) for x, y in ns["MOUNT"]]
    asm = slab
    for p in parts + (plug_cols if plugs else []):
        asm = asm + p
    return asm, slab, under, plug_cols, ns


def board_frame(f, z_top):
    """Location of the board frame from a model's (x, y) -> (X, Y) placement. A mirror is reported and replaced by
    the rotation that keeps the same USB end and footprint (the header edge then flips side): that's the real board."""
    o, ax, ay = f(0, 0), f(1, 0), f(0, 1)
    xv, yv = (ax[0] - o[0], ax[1] - o[1]), (ay[0] - o[0], ay[1] - o[1])
    hand = xv[0] * yv[1] - xv[1] * yv[0]
    if hand < 0:
        o = f(0, 30)
    return Location(Plane(origin=(o[0], o[1], z_top), x_dir=(xv[0], xv[1], 0), z_dir=(0, 0, 1))), hand > 0


def roll_in(frame, lip_y, theta=5.0, shift=1.2, drop=40.0, approach=None):
    """Board poses (board frame): descend tilted and shifted toward the clip side, slide the lip edge under the
    lips, roll down about the lip-side bottom edge onto the supports. Returns device Locations to apply to the
    board already placed at its final pose."""
    inv = frame.inverse()
    if lip_y is None:                         # snap-in on both edges: straight down
        return [frame * Pos(0, 0, drop * (1 - k / 8)) * inv for k in range(9)]
    sgn = 1 if lip_y == 0 else -1

    def pose(th, s, dz):
        roll = Pos(0, lip_y, -1.6) * Rot(sgn * th, 0, 0) * Pos(0, -lip_y, 1.6)
        return frame * Pos(0, sgn * s, dz) * roll * inv

    poses = []
    if approach:                              # (device direction, distance): how the tilted board reaches the bay
        d = Vector(*approach[0]).normalized()
        poses = [Pos(*(d * (approach[1] * (1 - k / 8)))) * pose(theta, shift, drop) for k in range(8)]
    poses += [pose(theta, shift, drop * (1 - k / 8)) for k in range(8)]
    poses += [pose(theta, shift * (1 - k / 4), 0) for k in range(4)]
    poses += [pose(theta * (1 - k / 5), 0, 0) for k in range(6)]
    return poses


def flex_zones(frame, clip_x, lip_x, clip_y):
    """Snap clips (beam, hook, tab) and lip crush bumps may give way while the board goes in. clip_y None: no fixed
    lips, the board drops straight in and every retainer on both edges is a clip."""
    if clip_y is None:
        return flex_zones(frame, tuple(clip_x) + tuple(lip_x), (), 30) + flex_zones(frame, tuple(clip_x) + tuple(lip_x), (), 0)
    lip_y = 30 - clip_y
    zones = []
    for x in clip_x:
        y0, y1 = (clip_y - 1.2, clip_y + 3.2) if clip_y == 30 else (-3.2, 1.2)
        zones.append(frame * bx(x - 3.8, x + 3.8, y0, y1, -30, 60))
    for x in lip_x:
        y0, y1 = (lip_y - 1.1, lip_y) if lip_y == 30 else (0, 1.1)
        zones.append(frame * bx(x - 1.3, x + 1.3, y0, y1, -0.4, 0.4))
    return zones


def lip_side(body, frame, lip_x):
    """Which long edge (board y = 0 or 30) of the real board has the fixed lips over it; None = no fixed lips."""
    def solid(y):
        p = frame * bx(lip_x[0] - 0.05, lip_x[0] + 0.05, y - 0.05, y + 0.05, 0.85, 0.95)
        return vol(p, body) > 0
    if solid(0.5) and solid(29.5):
        raise ValueError("fixed lips over both long edges: the board can't go in")
    return 0 if solid(0.5) else 30 if solid(29.5) else None


def usb_plug(frame):
    """USB-C plug, fully inserted, in the board frame: overmould 12 x 7 (25 long) outside the port face."""
    return bx(-25 + 1.4, 1.4, 16.1 - 6, 16.1 + 6, 5.7 - 3.5, 5.7 + 3.5)


# ---- insert ----------------------------------------------------------------------------------------------------
def check_insert():
    import insert as m
    dev = "insert"
    frame, proper = board_frame(m.on_board, m.board_top)
    report(dev, "board placement", proper, "rotation" if proper else
           "MIRRORED: the model's board can't exist with parts up; checking the real board (same USB end) instead")
    asm, slab, under, plugs, _ = board_parts(False, plugs=False)
    lip_y = lip_side(m.body, frame, m.LIP_X)
    report(dev, "retention found", True, f"fixed lips over real board edge y={lip_y}" if lip_y is not None else
           "no fixed lips: snap-in, straight down")
    clip_y = None if lip_y is None else 30 - lip_y
    body_flex = m.body
    for z in flex_zones(frame, m.CLIP_X, m.LIP_X, clip_y):
        body_flex = body_flex - z

    # 1-2 beam elements, lowered into their wells with the splices and wires already on
    els = []
    for name, el, rec, right in (("emitter", m.TX, m.TX_RECESS, True), ("receiver", m.RX, m.RX_RECESS, False)):
        body_d, fl_d, fl_t, tip_fl = el
        u_tip = m.S - rec
        u_fl = u_tip - tip_fl
        u_back = u_fl - fl_t - 0.3
        e = m.xcyl(u_fl, u_tip, m.BEAM_Y, m.BEAM_Z, body_d) + m.xcyl(u_fl - fl_t, u_fl, m.BEAM_Y, m.BEAM_Z, fl_d)
        e += m.box(u_back - 2.5, u_fl - fl_t, m.BEAM_Y - 0.3, m.BEAM_Y + 0.3, m.BEAM_Z - 1.5, m.BEAM_Z + 3)   # legs bent up
        e += m.zcyl(u_back - m.LEAD_SLOT / 2, m.BEAM_Y, m.BEAM_Z + 4, m.BEAM_Z + 16, 2.4)                  # splice
        e += m.zcyl(u_back - m.LEAD_SLOT / 2, m.BEAM_Y, m.BEAM_Z + 16, m.H_BODY - m.GROOVE_D, 1.4)        # wire up
        e = m.to_right(e) if right else e
        path(dev, f"{name} into its well", e, linear((0, 0, 1), 60), [("body", m.body)] + els)
        els.append((name, e))

    # 3 board: roll in under the lips, clips give way
    board = frame * asm
    path(dev, "board roll-in", board, roll_in(frame, lip_y), [("body", body_flex)] + els)
    path(dev, "board underside joints", frame * under, [Pos(0, 0, 0)], [("body", body_flex)], tol=0.05)
    path(dev, "USB-C plug", frame * usb_plug(frame), [Pos(0, 0, 0)], [("body", m.body), ("board", frame * slab)], tol=0.05)
    placed = els + [("board", board)]

    # 4 battery from the downstream face (user 2026-10-15). The drawer's end wall stands BALL_STORE in front of the
    # face, and the swap is done with up to 2 balls pushed to the far (left) side of that floor.
    r = m.BALL_D / 2
    wall = ("end wall", bx(-50, m.IW + 50, m.L + m.BALL_STORE, m.L + m.BALL_STORE + 10, 0, m.DRAWER_H))
    balls = ("2 balls", Pos(r + 1, m.L + m.BALL_STORE - r, r) * Sphere(r) + Pos(3 * r + 2, m.L + m.BALL_STORE - r, r) * Sphere(r))
    room = [("body", m.body), wall, balls]
    hold = m.to_right(m.box(m.SLOT_U0 + m.CLR + 0.2, m.SLOT_U1 - m.CLR - 0.2, m.SLOT_Y0, m.SLOT_Y0 + m.BAT[1],
                            m.SLOT_Z0, m.SLOT_Z0 + m.BAT[2]))   # crush ribs: 0.2 allowance
    out = m.L - m.SLOT_Y0 + 0.5                                  # travel until its back end clears the face
    path(dev, "holder slides out level", hold, linear((0, 1, 0), out, 16), room + placed)
    # pulled by the ribbon alone it tips once its centre passes the tunnel floor's edge, front onto the drawer floor
    piv_y, sag = [], []
    for k in range(9):
        t = m.REBATE_Y - m.SLOT_Y0 - m.BAT[1] / 2 + k * m.BAT[1] / 16
        a = -math.degrees(math.asin(min(1.0, m.SLOT_Z0 / (m.SLOT_Y0 + m.BAT[1] + t - m.REBATE_Y))))
        sag.append(Pos(0, m.REBATE_Y, m.SLOT_Z0) * Rot(a, 0, 0) * Pos(0, -m.REBATE_Y + t, -m.SLOT_Z0))
    path(dev, "holder half out, front sags", hold, sag[::-1] + [Pos(0, 0, 0)], [("body", m.body)], tol=0.5)
    placed.append(("holder", hold))
    jst_y1 = getattr(m, "JST_Y1", m.REBATE_Y - 0.5)               # parked pair's front (holder-lead) end
    jst = m.to_right(m.box(m.PK_U0 + 0.5, m.PK_U0 + 0.5 + m.JST[1], jst_y1 - m.JST[0], jst_y1,
                           m.SLOT_Z0 + 0.2, m.SLOT_Z0 + 0.2 + m.JST[2]))
    pull = m.L + 10 - (jst_y1 - m.JST[0])                        # board-side housing 10 mm past the face: grip both halves
    loop = getattr(m, "JST_LOOP", 40.0)                           # board-side slack tucked in the pocket
    report(dev, "board lead lets JST out", pull <= loop, f"pair must come {pull:.0f} mm out, the {loop:.0f} mm loop allows it"
           if pull <= loop else f"pair must come {pull:.0f} mm out, the loop gives {loop:.0f}")
    path(dev, "JST pair pulled out", jst, linear((0, 1, 0), pull, 8), room + placed)
    gap = m.REBATE_Y - jst_y1
    report(dev, "holder lead turns at JST", gap >= 4.0, f"{gap:.1f} mm between the pair's lead end and the hatch "
           "(a 180° turn of the 2-wire lead needs >= 4)")
    du = m.PK_U0 + m.JST[1] / 2 - (m.SLOT_U0 + m.SLOT_U1) / 2
    need = jst_y1 + pull - (m.REBATE_Y - m.LEAD_GAP) + du + 5  # holder end -> pulled-out pair, + exit bend
    report(dev, "holder lead reaches JST out", need <= 70, f"needs {need:.0f} mm, electronics' minimum 70")
    placed.append(("JST", jst))
    for name, length in (("straight", m.USB_STRAIGHT), ("right-angle", m.USB_RA)):
        plug = m.box(m.usb_u - m.USB_PLUG[0] / 2, m.usb_u + m.USB_PLUG[0] / 2, m.board_y1 + m.USB_PROTRUDE, m.L + length,
                     m.usb_z - m.USB_PLUG[1] / 2, m.usb_z + m.USB_PLUG[1] / 2)
        path(dev, f"USB-C {name} plug", plug, linear((0, 1, 0), 10, 4), [("body", m.body), wall])

    # 5 Dupont plugs onto the headers, then hatch and lid
    cols = [frame * c for c in plugs]
    for i, c in enumerate(cols):
        path(dev, f"Dupont plug {i + 1}", c, linear((0, 0, 1), 30, 4), [("body", m.body)] + els)
    placed += [(f"plug {i + 1}", c) for i, c in enumerate(cols)]
    path(dev, "battery hatch (end face)", m.hatch, linear((0, 1, 0), 30, 4), room + placed, tol=2.0)
    path(dev, "left lid", m.left_lid, linear((0, 0, 1), 30, 4), [("body", m.body)] + placed, tol=3.0)

    # ramps: a ball dropping through the entrance can't rest on the flat top past them (vertical drop, worst tilt)
    reach = m.ENTRANCE_END_Y + m.ENTRANCE_ERR - r - m.INSERT_Y0      # furthest ball centre, insert y
    lean = r * math.sin(math.radians(SLOPE_MAX))                 # a ball on an edge rests within this of it
    above = bx(-50, m.IW + 50, m.Y_R - 1.0, m.Y_R - 0.2, m.RAMP_EDGE_H + math.tan(math.radians(m.RAMP_DEG)) * m.S + 0.5,
               m.H_BODY + m.LID_T + 1)
    v = vol(above, m.body) + vol(above, m.left_lid)
    report(dev, "ramps run to Y_R", v < 0.05, f"{v:.1f} mm³ of plastic above the ramp just before y={m.Y_R:.1f}")
    report(dev, "no rest on flat top", m.Y_R - reach > lean, f"furthest centre {m.Y_R - reach:.1f} mm short of the "
           f"flat top; on its edge a ball needs < {lean:.1f} at {SLOPE_MAX}°")

    # calibration sockets under the lid hole (reached with tweezers from above)
    ns = perfboard(False)
    cal = [p for p in ns["PARTS"] if p[0].startswith(("R_LED", "R_PU"))]
    xs = [ns["xy"](*q)[0] for _, a, b, _ in cal for q in (a, b)]
    ys = [ns["xy"](*q)[1] for _, a, b, _ in cal for q in (a, b)]
    shaft = frame * bx(min(xs) - 1, max(xs) + 1, min(ys) - 1, max(ys) + 1, 14, 80)
    v = vol(shaft, m.left_lid)
    report(dev, "cal sockets under lid hole", v < 0.5, f"{v:.0f} mm³ of lid over the sockets" if v >= 0.5 else "open from above")


# ---- goal-counter sled (SLED-ASSEMBLY.md) ------------------------------------------------------------------------
def frame_plate(s, e_l):
    """The black frame: a plate from the outer face to the tube's inner end (s 0-35) with the 130 x 55 R10 opening,
    its bottom on the bar (Z_BAR over the tunnel floor), its left edge e_l from L's left face (y = -r)."""
    w, h, rc = s.rt.OPEN[:3]
    y0, y1, z0, z1 = -e_l - w, -e_l, s.Z_BAR, s.Z_BAR + h
    hole = bx(-30, 40, y0 + rc, y1 - rc, z0, z1) + bx(-30, 40, y0, y1, z0 + rc, z1 - rc)
    for y in (y0 + rc, y1 - rc):
        for z in (z0 + rc, z1 - rc):
            hole += Pos(-30, y, z) * Rot(0, 90, 0) * Cylinder(rc, 70, align=MINZ)
    return bx(0, 35, -400, 300, -50, 150) - hole


def pitch_roll_in(frame, lip_y, pitch=12.0, dx=1.3, theta=5.0, shift=1.2, drop=40.0):
    """roll_in with the board's far end up first: its USB end goes in under an overhang at the front wall (the
    sled's button ring), dx behind its seat, then slides forward, pitches down, and rolls under the lips. The window
    is narrow: at 12 deg, 1.3 back, the far end stays inside the back stop (0.3 behind the seat) and the USB
    receptacle's top, leaning forward, stays behind the ring (0.9 over the board's front edge)."""
    inv, sgn = frame.inverse(), 1 if lip_y == 0 else -1
    pitch_ = lambda a: Rot(0, -a, 0)                     # about its top front edge: nothing swings into the wall  # noqa: E731
    roll = lambda th: Pos(0, lip_y, -1.6) * Rot(sgn * th, 0, 0) * Pos(0, -lip_y, 1.6)                # noqa: E731
    pose = lambda a, x, th, sh, dz: frame * Pos(x, sgn * sh, dz) * roll(th) * pitch_(a) * inv        # noqa: E731
    poses = [pose(pitch, dx, theta, shift, drop * (1 - k / 8)) for k in range(8)]
    poses += [pose(pitch, dx * (1 - k / 4), theta, shift, 0) for k in range(4)]
    poses += [pose(pitch * (1 - k / 8), 0, theta, shift, 0) for k in range(8)]
    poses += [pose(0, 0, theta, shift * (1 - k / 4), 0) for k in range(4)]
    return poses + [pose(0, 0, theta * (1 - k / 5), 0, 0) for k in range(6)]


def ray(p, elev, length=260.0, r=0.25, yaw=0.0):
    """A thin sightline from point p (s, y, z) toward the viewer outside: along -s, rising at elev degrees, turned
    yaw degrees toward +y (the viewer standing to the left, as seen from the opening)."""
    ce, ry = math.cos(math.radians(elev)), math.radians(yaw)
    d = (-ce * math.cos(ry), ce * math.sin(ry), math.sin(math.radians(elev)))
    return Location(Plane(origin=p, z_dir=d)) * Cylinder(r, length, align=MINZ)


def check_sled():
    import sled as s
    dev = "sled"
    body = s.part_l
    e_ls = s.E_L if isinstance(s.E_L, tuple) else (s.E_L,)        # EST range: both ends
    frame = Location(Plane(origin=(s.B0[0], s.B0[1], s.B_TOP), x_dir=(1, 0, 0), z_dir=(0, 0, 1)))
    asm, slab, under, plugs, ns = board_parts(False, plugs=False)
    lip_x, clip_x = (20.0, 45.0), (24.0, 60.0)                  # dimensions.md; sled.py builds them at these x
    lip_y = lip_side(body, frame, lip_x)
    report(dev, "retention found", lip_y == 30, f"fixed lips over real board edge y={lip_y} (socket edge = 30)")
    body_flex = body
    for z in flex_zones(frame, clip_x, lip_x, 30 - lip_y if lip_y is not None else None):
        body_flex = body_flex - z

    # 4.1 emitter into its trough (legs bent toward -s)
    em = s.emitter + s.em_legs
    path(dev, "emitter into its trough", em, linear((0, 0, 1), 40, 8), [("L", body)])
    placed = [("emitter", em)]

    # 4.3 board: far end up ~12 deg, header edge up ~8 deg, USB end toward the lane's back wall, socket edge under the
    # lips, onto the one pin, clips; then the plugs
    board = frame * asm
    path(dev, "board pitch + roll-in", board, pitch_roll_in(frame, lip_y, theta=8.0), [("L", body_flex)] + placed)
    path(dev, "board underside joints", frame * under, [Pos(0, 0, 0)], [("L", body_flex)], tol=0.05)
    placed.append(("board", board))
    cols = [frame * c for c in plugs]
    names = [p[0] for p in ns["PARTS"] if p[0].startswith("J_") and not p[0].startswith(SOLDERED)]
    pig = getattr(s, "ph_pair", None) is not None               # round 3: J_BAT is a soldered JST-PH pigtail, no Dupont
    for name, c in zip(names, cols):
        if pig and name == "J_BAT":
            continue
        path(dev, f"plug {name}", c, linear((0, 0, 1), 30, 4), [("L", body)] + [p for p in placed if p[0] != "board"])
    placed += [(f"plug {n}", c) for n, c in zip(names, cols) if not (pig and n == "J_BAT")]
    if pig:                                                     # the mated PH pair: into its pocket, and out to unplug
        path(dev, "J_BAT PH pair into its pocket", s.ph_pair, linear((0, 0, 1), 30, 6), [("L", body)] + placed)
        path(dev, "J_BAT PH pair lifts out", s.ph_pair, linear((0, 0, 1), 25, 6)[::-1], [("L", body)] + placed)
        placed.append(("PH pair", s.ph_pair))

    # 4.4 dash parts, dash off L: OLED from behind and below along its face normal, button from the front, buzzer up
    # into its sleeve, header down into the bay's slot
    dash_in = [("dash", s.dash)]
    oled = s.module + s.ol_socket if hasattr(s, "ol_socket") else s.module   # its unused PH socket rides on its back
    path(dev, "OLED drops into its slot", oled, linear((0, 0, 1), 25, 6), dash_in)   # from the dash's top
    if hasattr(s, "ol_lead"):
        v = vol(s.ol_lead, s.dash)
        report(dev, "OLED's 4-wire lead route", v < 0.5, f"{v:.1f} mm³ of the dash in the wires' way from its left holes")
    held = {d: vol(Pos(*v) * s.module, s.dash) for d, v in (("-s", (-0.5, 0, 0)), ("+s", (0.5, 0, 0)), ("up", (0, 0, 1.0)))}
    report(dev, "OLED held in its slot", held["-s"] > 0 and held["+s"] > 0,
           "moved 0.5 it meets the window / rails ({:.1f} / {:.1f} mm³); lifted 1 mm it meets {:.1f} mm³".format(
               held["-s"], held["+s"], held["up"]))
    dash_in.append(("OLED", s.module))
    # undo key (MX): the switch clips into its plate from the front, plate + switch slide up into the dash's slot, the
    # keycap goes onto the stem through the face's tunnel and locks them; the stem then travels MX[7]
    path(dev, "MX switch into its plate", s.switch, linear((-1, 0, 0), 20, 8), [("plate", s.sw_plate)])
    path(dev, "key plate up into its slot", s.sw_plate + s.switch, linear((0, 0, -1), 30, 8), dash_in)
    dash_in.append(("key", s.sw_plate + s.switch_body))
    path(dev, "keycap onto the stem", s.keycap, linear((-1, 0, 0), 15, 6), dash_in)
    v = vol(Pos(0, 0, -1.0) * (s.sw_plate + s.switch + s.keycap), s.dash)
    report(dev, "keycap locks the key plate", v > 0, f"with the cap on, plate + switch moved 1 down meet {v:.1f} mm³ of the dash")
    path(dev, f"key travels {s.MX[7]:g}", s.keycap + s.stem, linear((1, 0, 0), s.MX[7], 4)[::-1],
         [("dash", s.dash), ("plate", s.sw_plate)])
    dash_in.append(("keycap", s.keycap + s.stem))
    path(dev, "buzzer down into its sleeve", s.buzzer, linear((0, 0, 1), 25, 6), dash_in)
    dash_in.append(("buzzer", s.buzzer))
    for name, ld in zip(("green", "red"), getattr(s, "leds", [])):   # status LEDs: down the open channel behind the
        back = s.LED[0] + s.LED[1] + 0.2                        # the least slide: its tip just behind the bore
        ly, lz = s.LEDS[0 if name == "green" else 1]
        fe = s.DASH[0] + s.LED[0] + s.LED[1] + s.LED[2]          # flange's back face
        real = (ld & bx(0, fe, -200, 200, -50, 200)) + bx(fe, fe + 2.5, ly - 1.5, ly + 1.5, lz - 0.3, lz + 0.3) + \
            bx(fe + 2.0, fe + 2.5, ly - 1.5, ly + 1.5, lz - 0.3, s.OZ + 3.0)   # legs 2 straight (datasheet), then up
        path(dev, f"{name} LED into its channel", real, legs(((1, 0, 0), back, 4), ((0, 0, 1), 25, 6)), dash_in)   # then forward
        v = vol(Pos(-0.3, 0, 0) * ld, s.dash)
        report(dev, f"{name} LED on its step", v > 0, f"pushed 0.3 further it meets {v:.2f} mm³ (flange on the step)")
        dash_in.append((f"{name} LED", ld))
    path(dev, "mouth header into its slot", s.hdr, linear((0, 0, 1), 25, 6), dash_in)
    dash_in.append(("header", s.hdr))

    # 4.5 dash onto L, straight down; its two snap bumps flex in and click into L's side windows
    bumps = [bx(s0 - 0.5, s1 + 0.5, -4, 0.5, 41.5, 45.0) if y0 == -s.T else bx(s0 - 0.5, s1 + 0.5, y0 - 0.5, y0 + 4, 41.5, 45.0)
             for y0, (s0, s1) in s.SNAP]
    dash_all = s.dash + s.module + s.sw_plate + s.switch + s.keycap + s.buzzer + s.hdr
    for ld in getattr(s, "leds", []):
        dash_all = dash_all + ld
    dash_flex = dash_all
    for b in bumps:
        dash_flex = dash_flex - b
    path(dev, "dash onto L", dash_flex, linear((0, 0, 1), 40, 8), [("L", body)] + placed)
    up = Pos(0, 0, 1.0)
    v = [vol(up * (s.dash & b), body) for b in bumps]
    report(dev, "dash snaps hold", all(x > 0 for x in v), "lifted 1 mm, the bumps hit " + " / ".join(f"{x:.1f}" for x in v) + " mm³ of L")
    v = vol(s.duct, body) + vol(s.duct, s.dash)
    report(dev, "lead duct clear (S31)", v < 0.5, f"{v:.1f} mm³ of plastic in the r 1.2-19 strip" if v >= 0.5 else
           "the dash's leads have the hidden strip to the board, off the lane")
    placed.append(("dash", dash_all))

    # 4.6 lid: front up ~5 mm (2 deg) about its rear lips' tops, in from above, pushed back into the windows, lowered
    # until its front tab clicks into the dash's back wall (the tab is a flex zone)
    pv = Vector(199.0, 0, s.Z1 - 1.8)
    tilt = lambda a: Pos(pv) * Rot(0, a, 0) * Pos(-pv)          # noqa: E731
    tab = bx(s.t0 - 1.0, s.t0 + 1.4, s.TABW[1] - 0.2, s.TABW[0] + 0.2, -10, 100)
    lid = s.lid - tab
    poses = [Pos(-1.5, 0, 30 * (1 - k / 6)) * tilt(2) for k in range(6)] + [Pos(-1.5 * (1 - k / 4), 0, 0) * tilt(2) for k in range(4)]
    path(dev, "lid at 2 deg: lips, tab", lid, poses + [tilt(2 * (1 - k / 8)) for k in range(9)], [("L", body)] + placed)
    v_front, v_rear = vol(up * (s.lid & tab), s.dash), vol(up * lid, body)
    report(dev, "lid held", v_front > 0 and v_rear > 0,
           f"lifted 1 mm, the front tab hits {v_front:.1f} mm³ of the dash and the rear lips {v_rear:.1f} mm³ of L")
    placed.append(("lid", s.lid))

    # 5 R, installed
    path(dev, "receiver pair in bridge rebate", s.pair_bridge, [Pos(0, 0, 0)], [("R", s.part_r)], tol=0.05)
    placed.append(("R", s.part_r))

    # 6.4 / 7 drawer: in from the pulled-out pose (holder clear of the frame), through the opening, past a ball waiting at
    # the mouth, into the lane; the latch bump rides the lane wall (flex zone), the lead's tab rides its slit.
    r = s.rt.BALL[1] / 2
    ball = ("ball at the mouth", Pos(s.rt.Q0 + r, -s.BLK - r - 0.5, r) * Sphere(r))
    tray = s.drawer - s.latch_bump + s.holder
    out = -s.DRAWER_OUT.position.X
    for e in e_ls:
        fr = (f"frame (e_L {e:g})", frame_plate(s, e))
        path(dev, f"drawer in, e_L {e:g}", tray, linear((-1, 0, 0), out, 25),
             [("L", body), fr, ball] + placed, tol=0.5)
    v_home, v_pull = vol(s.latch_bump, body), vol(Pos(-1.0, 0, 0) * s.latch_bump, body)
    report(dev, "drawer latch clicks + holds", v_home < 0.05 and v_pull > 0,
           f"bump {v_home:.2f} mm³ in the wall at home; pulled 1 mm it hits {v_pull:.2f} mm³ (the notch holds it)")
    # the battery lead (keyed, stays plugged): a rolling U under the rail. It must keep its length at every drawer
    # position (no stretch, no slack piling up) and never be pinched by anything, fixed or moving, from home to fully
    # out; its ends are relieved (zip-tie slots at the ledge, the tab's glue groove)
    ds_ = [12.5 * k for k in range(11)]
    lens = [s.lead_len(d) for d in ds_]
    report(dev, "battery lead keeps its length", max(lens) - min(lens) <= 1.0,
           f"{min(lens):.1f}-{max(lens):.1f} from home to {ds_[-1]:g} out (J_BAT to the holder's joint; spec {s.LEAD_LEN:.0f})")
    jb = Pos(*s.J_BAT) * Sphere(8.0)                            # the plug end: it is meant to touch J_BAT
    others = [(n, c) for n, c in placed if n.startswith("plug") or n in ("board", "dash", "lid", "R")]
    pinch = []
    for d in ds_:
        fixed, moving, _ = s.lead_pts(d)
        joint = Pos(*moving[-1]) * Sphere(6.0)                  # the holder's joint, inside the tray
        tabz = bx(s.A_S - d - 6.0, s.A_S - d + 6.0, -200, 200, -50, 200)
        tube = s.lead_tube(d) - jb - joint
        obs = [("L", body)] + others + [("drawer", Pos(-d, 0, 0) * s.drawer - tabz), ("holder", Pos(-d, 0, 0) * s.holder)]
        bad = [(n, vol(tube, o)) for n, o in obs]
        bad = [(n, v) for n, v in bad if v > 0.5]
        if bad:
            pinch.append(f"{d:g} out: " + ", ".join(f"{n} {v:.1f}" for n, v in bad))
    report(dev, "battery lead never pinched", not pinch, f"clear at {len(ds_)} positions, home to {ds_[-1]:g} out" if not pinch
           else "; ".join(pinch))
    if hasattr(s, "tether_tube"):                               # the stop cord: rolls beside the lead, taut at the end
        tl = [s.tether_len(d) for d in ds_]
        # both are anchored on the drawer's tab (cord tied to its front, lead glued in its groove), so contact there moves
        # nothing; anywhere else the cord must touch nothing
        tz = lambda d: bx(s.A_S - d - 8, s.A_S - d + 3, -200, 200, -50, 200)   # noqa: E731  the tab, +-0.5
        clash = [f"{d:g}" for d in ds_ if vol(s.tether_tube(d) - tz(d), s.lead_tube(d)) > 0.01 or
                 vol(s.tether_tube(d), body) > 0.5 or vol(s.tether_tube(d) - tz(d), Pos(-d, 0, 0) * s.drawer) > 0.5]
        taut = s.tether_pts(ds_[-1])[1] is None                 # no U left at full travel: the cord stops the drawer
        slack = s.lead_slack(ds_[-1])
        report(dev, "stop cord takes the pull", max(abs(x - s.CORD_L) for x in tl) <= 1.0 and not clash and taut and slack >= 4.0,
               f"cord {min(tl):.1f}-{max(tl):.1f} (cut {s.CORD_L:.1f}), clear of the lead/L/drawer at every pose"
               + (f" (not at {', '.join(clash)})" if clash else "") +
               f"; at {ds_[-1]:g} out it is {'taut' if taut else 'still slack'} and the lead has {slack:.1f} of slack left")
    if hasattr(s, "fuse"):
        v = vol(s.fuse, s.drawer) + vol(s.fuse, s.holder) + vol(s.fuse, s.lead_home)
        report(dev, "fuse F1 fits behind the holder", v < 0.5, f"{v:.1f} mm³ of drawer, holder or lead in its envelope")
    slots = [bx(158.0, 161.0, y - 0.8, y + 0.8, s.LEAD[1] - 3, s.LEAD[1]) for y in (s.LEAD[3] + 2.6, s.LEAD[3] - 2.6)]
    v_slots = sum(vol(sl, body) for sl in slots)
    groove = s.lead_home & bx(s.A_S - 2.5, s.A_S + 2.5, -200, s.DR[4] + 1.3, -50, 200)   # the tab, outside the tray
    v_tab = vol(groove, s.drawer)
    report(dev, "battery lead strain relief", v_slots < 0.05 and v_tab < 0.5,
           f"zip-tie slots open beside the lead at s 158-161 ({v_slots:.2f} mm³ of plastic in them); the lead lies in the tab's "
           f"groove ({v_tab:.2f} mm³ through solid)")
    # the lead snakes round the posts behind the holder: every free gap along s there must pass it (probed in the model)
    hb_ = s.holder.bounding_box()
    zs, gaps, run, inside = (s.DR[5] + 1.2 + 6.0), [], 0.0, False
    for k in range(int((s.DR[2] - hb_.max.X) / 0.1) + 1):
        x = hb_.max.X + 0.1 * k
        solid_ = any(vol(bx(x - 0.04, x + 0.04, y - 0.04, y + 0.04, zs - 0.04, zs + 0.04), s.drawer) > 0 for y in (-60.0, -66.0))
        if solid_ and run > 0:
            gaps.append(run)
            run = 0.0
        elif not solid_:
            run += 0.1
    need_g = max(s.LEAD[0], 4.0) + 0.4                         # the lead, or its heat-shrunk joint (~Ø4, electronics)
    report(dev, "room for lead + joint behind holder", bool(gaps) and min(gaps) >= need_g,
           f"free gaps along s behind the holder: {', '.join(f'{g:.1f}' for g in gaps)} (the Ø4 joint needs >= {need_g:.1f})")
    stop = min(vol(Pos(0.3, 0, 0) * s.drawer, body), 1e9)
    report(dev, "drawer hard stop", stop > 0, f"pushed 0.3 further it hits {stop:.1f} mm³ of L (the stand-offs on the back wall)")

    # 7.2 swap: outside, the holder lifts out of the tray (tabs spread: flex), on its lead to the targets; its cover slides
    # off forward along its length
    tabs = bx(s.HS[0] - 1, s.HS[1] + 1, s.DR[4] - 3, s.DR[3] + 3, s.H_TOP - 0.2, s.H_TOP + 1.0)
    dr_out = s.DRAWER_OUT * (s.drawer - tabs)
    hold_out = s.DRAWER_OUT * s.holder
    lift = s.DR[6] - (s.DR[5] + 1.2) + 1.0                        # clears the tray's walls and front block
    path(dev, "swap: holder lifts out", hold_out, linear((0, 0, 1), lift, 6), [("tray", dr_out)])
    hb = s.holder.bounding_box()
    lead_end = Vector(hb.max.X, (hb.min.Y + hb.max.Y) / 2, (hb.min.Z + hb.max.Z) / 2 + lift)   # leads from its rear end
    jt = Vector(*s.lead_pts(0.0)[1][-1])                        # the holder's joint with the battery lead (drawer frame)
    need = (lead_end - jt).length + 5
    have = getattr(s, "HOLDER_LEAD", 30.0)                     # the holder's own lead to the joint (last spec ~30)
    report(dev, "swap: lead lets it lift", need <= have, f"needs ~{need:.0f} of the holder's own lead (rear end to the joint "
           f"+ 5); specified {have:g}")
    cover = bx(hb.min.X, hb.max.X, hb.min.Y, hb.max.Y, hb.max.Z - 3.0, hb.max.Z)
    path(dev, "swap: cover slides off", s.DRAWER_OUT * Pos(0, 0, lift) * cover, legs(((1, 0, 0), s.HOLDER[0] + 2, 8)),
         [("tray", dr_out)])

    # 7 reflash: drawer out, a slim plug laid on the lane floor and pushed in to the port, through the frame
    plug = frame * usb_plug(frame) + Pos(s.USB[0] - 25 + 1.4, s.USB[1], s.USB[2]) * Rot(0, -90, 0) * Cylinder(2.0, 150, align=MINZ)
    for e in e_ls:
        fr = (f"frame (e_L {e:g})", frame_plate(s, e))
        path(dev, f"USB-C plug via the lane, e_L {e:g}", plug, linear((-1, 0, 0), 160, 32),
             [("L", body), fr, ("board", frame * slab)] + [p for p in placed if p[0] != "board"], tol=0.05)
    lane_w = s.LANE[2] - s.LANE[3]
    off = abs((s.LANE[2] - (s.KEY - 0.3) - 6.5) - s.USB[1])      # a 13-wide plug slid along the lane's left wall,
                                                                    # riding over the keyed corner's 1.2 ridge
    report(dev, "USB funnel catches a plug", off <= 1.5, f"a plug run along the lane's left wall is {off:.1f} off the port; "
           f"the 16-wide funnel catches +-1.5 (the lane is {lane_w:.0f} wide)")

    # 6.3 mouth plug: pulled straight out through the frame; pushed home from the dash face by a fingertip
    rest = [p for p in placed if p[0] != "dash"] + [("dash", s.dash + s.module + s.sw_plate + s.switch + s.keycap + s.buzzer)]
    for e in e_ls:
        fr = (f"frame (e_L {e:g})", frame_plate(s, e))
        path(dev, f"mouth plug out, e_L {e:g}", s.housing, linear((-1, 0, 0), 60, 12),
             [("L", body), fr, ("header", s.hdr - s.housing)] + rest, tol=0.05)
    behind = s.housing.bounding_box().min.X - s.DASH[0]
    report(dev, "mouth plug pushed from the face", behind <= 1.0, f"its front end is {behind:.1f} behind the dash face "
           "(a fingertip reaches <= 1 into the bay)")
    if hasattr(s, "pair_bay"):                                  # R's pair: out of the plug's front, turned, up to R
        hb = s.pair_bay.bounding_box()
        path(dev, "receiver pair route clear", s.pair_bay, [Pos(0, 0, 0)],
             [("L", body), ("dash", s.dash), ("OLED", s.module), ("drawer", s.drawer)], tol=0.05)
        report(dev, "receiver pair above the drawer", hb.min.Z > s.DR[6], f"lowest {hb.min.Z:.1f} vs the drawer's top {s.DR[6]:.1f}")

    # OLED: sightlines from its active area toward a viewer outside, 0-30 deg up. The sled's own parts (L, dash, lid) may
    # hide none of it (S32); above ~20 deg the frame's top edge hides its top rows, which no layout can change, so that
    # is reported as the viewing range, not failed.
    ab = s.active.bounding_box()
    pts = [(ab.min.X - 0.3, ab.min.Y + (ab.max.Y - ab.min.Y) * (i + 0.5) / 5, ab.min.Z + (ab.max.Z - ab.min.Z) * (j + 0.5) / 3)
           for i in range(5) for j in range(3)]
    for e in e_ls:
        fr = frame_plate(s, e)
        for yaw in (-20, 0, 20):
            own, full = 0, None
            for el in range(0, 31, 5):
                rays = [ray(pt, el, yaw=yaw) for pt in pts]
                own += sum(any(vol(rr, o) >= 0.01 for o in (body, s.dash, s.lid)) for rr in rays)
                if all(vol(rr, fr) < 0.01 for rr in rays):
                    full = el
            report(dev, f"OLED seen, e_L {e:g}, yaw {yaw:+d}", own == 0 and full is not None and full >= 15,
                   f"no sled part hides any of {len(pts)} points at 0-30 deg up; whole active area seen up to {full} deg"
                   if own == 0 else f"{own} sightlines hidden by the sled itself (full view up to {full} deg)")

    # service grip: drawer out, a finger through the frame and the empty lane, its tip curled 5 into the window in the
    # lane's right wall; pulling back and lifting must bear on L itself
    if hasattr(s, "PULL"):
        sm, zm = (s.PULL[0] + s.PULL[1]) / 2, (s.PULL[2] + s.PULL[3]) / 2
        yc = s.LANE[3] + 7.5
        tip = Pos(sm, yc, zm) * Rot(90, 0, 0) * Cylinder(6.0, yc - (s.LANE[3] - 5.0), align=MINZ)
        finger = Pos(-60, yc, zm) * Rot(0, 90, 0) * Cylinder(7.0, sm + 60, align=MINZ) + tip
        for e in e_ls:
            path(dev, f"finger on the grip, e_L {e:g}", finger, [Pos(0, 0, 0)],
                 [("L", body), ("dash", dash_all), ("lid", s.lid), ("R", s.part_r), ("frame", frame_plate(s, e))])
        ds_, dz_ = sm - 6.0 - s.PULL[0] + 1.0, s.PULL[3] - (zm + 6.0) + 1.0   # the window's slack + 1
        v_pull, v_lift = vol(Pos(-ds_, 0, 0) * tip, body), vol(Pos(0, 0, dz_) * tip, body)
        report(dev, "grip takes pull + lift on L", v_pull > 0 and v_lift > 0,
               f"tip moved {ds_:.1f} back meets {v_pull:.1f} mm³ of L's wall, lifted {dz_:.1f} meets {v_lift:.1f} mm³ (not the dash)")

    # undo key pressed by a fingertip (a Ø16 pad, rigid: a soft one does a little better) straight in through the frame:
    # how far its front gets into the tunnel vs where the MX clicks (cap face + 2.2 pre-travel, EST)
    if hasattr(s, "keycap"):
        face = s.keycap.bounding_box().min.X
        click = face + 2.2
        for e in e_ls:
            obs = [body, s.dash, frame_plate(s, e)]
            reach = None
            for k in range(0, 80):
                d = face - 4.0 + 0.1 * k                         # the pad's front point
                pad = Pos(d - 8.0, s.BTN[0], s.BTN[1]) * Sphere(8.0)
                if any(vol(pad, o) > 0.5 for o in obs):
                    break
                reach = d
            ok = reach is not None and reach >= click
            report(dev, f"fingertip clicks the key, e_L {e:g}", ok,
                   f"the pad gets {reach - face:.1f} past the cap face, the click is at 2.2" if reach is not None else
                   "the pad can't reach the cap face")

    # status LEDs: their faces seen through their holes, straight on and +-20 deg, 0-15 deg up, inside the opening
    for name, (ly, lz) in zip(("green", "red"), getattr(s, "LEDS", [])):
        face = (s.DASH[0] + s.LED[0] - 0.3, ly, lz)
        for e in e_ls:
            fr = frame_plate(s, e)
            hid = [f"{yaw:+d}/{el}" for yaw in (-20, 0, 20) for el in (0, 5, 10, 15)
                   if any(vol(ray(face, el, r=0.2, yaw=yaw), o) >= 0.01 for o in (body, s.dash, s.lid, fr))]
            report(dev, f"{name} LED seen, e_L {e:g}", not hid, "seen at yaw -20/0/+20, 0-15 deg up" if not hid
                   else "hidden at yaw/elev " + ", ".join(hid))

    # calibration sockets reached through the lid's hole (lid on, sled out)
    cal = [p for p in ns["PARTS"] if p[0].startswith(("R_LED", "R_PU"))]
    xs = [ns["xy"](*q)[0] for _, a, b, _ in cal for q in (a, b)]
    ys = [ns["xy"](*q)[1] for _, a, b, _ in cal for q in (a, b)]
    shaft = frame * bx(min(xs) - 1, max(xs) + 1, min(ys) - 1, max(ys) + 1, 14, 80)
    v = vol(shaft, s.lid) + vol(shaft, body)
    report(dev, "cal sockets under lid hole", v < 0.5, f"{v:.0f} mm³ over the sockets" if v >= 0.5 else "open from above")


# ---- scoreboard --------------------------------------------------------------------------------------------------
def check_scoreboard():
    import scoreboard as m
    dev = "scoreboard"
    out = Vector(*m.FACE.z_dir)                       # out of the face
    up = Vector(*m.FACE.y_dir)                        # up the slope, parallel to the face
    placed = []

    def face_path(engage, slope=0.0):                # home along the face normal <- down the slope <- in through the back
        return legs(*([(-out, engage, 4)] + ([(up, slope)] if slope else []) + [((0, 1, 0), 110)]))

    def face_step(step, part, engage=3.0, slope=0.0, tol=0.5):
        path(dev, step, part, face_path(engage, slope), [("body", m.body)] + placed, tol=tol)
        placed.append((step, part))

    for i, t in enumerate(m.nfc_tags):             # guide step 1: tags first, nothing else is in yet
        sx = 1 if t.center().X > m.W / 2 else -1
        path(dev, f"NFC tag {i + 1}", t, linear((-sx, 0, 0), 2.5, 3), [("body", m.body)])   # a sticker: only its seat
        placed.append((f"NFC tag {i + 1}", t))
    # v4: opal diffuser bar into its pocket from the inside (before the LED strip: the LEDs would be in its way)
    face_step("diffuser bar", m.diffuser, engage=12.0, slope=10)
    # MX: the plate with its 4 switches clipped in and hand-wired goes onto 3 stake pins (heat-staked)
    keys = m.plate + m.wiring
    for sw in m.switches:
        keys = keys + sw
    # S18 keyholes: on over the 3 post heads held KEYHOLE[0] up the slope, then slid down onto the necks
    path(dev, "MX plate + switches + wiring", keys, legs((up, m.KEYHOLE[0], 3), (-out, m.PLATE_TRAVEL + 0.5, 4), (up, 32), ((0, 1, 0), 110)),
         [("body", m.body)] + placed)
    placed.append(("MX plate + switches + wiring", keys))
    leds = m.strip
    for led in m.leds:                            # LEDs are soldered on the LED-only strip first
        leds = leds + led
    face_step("LED strip + LEDs", leds, engage=m.STRIP[2] + 0.4 + 0.5, slope=30)   # off its 2 pins
    face_step("glass", m.glass)
    face_step("retainer frame", m.frame, engage=3.5 + 0.5)                          # off the 4 pins
    face_step("adapter + wires", m.adapter + m.ad_wires, engage=2.0)
    # v5: PCA9685 stands on its long edge in 2 floor slots, after the frame (the frame can't pass it): 10 up, then down
    path(dev, "PCA9685 into its slots", m.pca, legs(((0, 0, 1), 10, 3), ((0, 1, 0), 110)), [("body", m.body)] + placed)
    placed.append(("PCA9685", m.pca))
    # v5: badge insert + LED5 into its window in the right wing's face (12 off the face, then out), then the reader
    # parallel to the face behind it, flat back out, onto its 4 pads
    lit = m.tile + m.led5 + m.led5_wires
    path(dev, "badge insert + LED5", lit, legs((-out, 12, 6), ((0, 1, 0), 110)), [("body", m.body)] + placed)
    placed.append(("badge insert + LED5", lit))
    path(dev, "RC522 reader", m.rc522, legs((-out, 6, 3), ((0, 1, 0), 110)), [("body", m.body)] + placed)
    placed.append(("RC522 reader", m.rc522))
    # S16 along the face normal: the reader's back holds the insert's shoulder. A gap lets the insert rattle; an insert
    # thicker than the reader's air stops the reader short of its foam tape. Band 0..0.15 for print tolerance.
    n_out = lambda d, x: Pos(*(out * d)) * x   # noqa: E731
    touch, near = vol(m.rc522, m.tile), vol(n_out(0.15, m.rc522), m.tile)
    report(dev, "badge insert held flush", touch < 0.5 and near > 0,
           f"reader overlaps the insert {touch:.1f} mm³ (it can't reach its tape)" if touch >= 0.5 else
           ("reader within 0.15 of the insert's shoulder" if near > 0 else "insert can move > 0.15 off the reader (rattles)"))
    for i, c in enumerate(m.caps):                # MX caps go on last, pushed onto the stems from outside
        path(dev, f"key cap {i + 1} (from outside)", c, linear(tuple(out), 15, 6), [("body", m.body)] + placed)
    # S18: with the caps on, the keyhole plate can't slide up its 3 mm to release (not just gravity holding it)
    caps = m.caps[0]
    for c in m.caps[1:]:
        caps = caps + c
    stuck = vol(Pos(*(up * 1.0)) * caps, m.body)
    report(dev, "key plate locked by the caps", stuck > 0.5, f"caps hit the face {stuck:.0f} mm³ after 1 mm up the slope")

    # v5 sound: option A (amp + speaker in its cup) or option B (buzzer in its disc) in the same right-wall lip. They are
    # alternatives, so the rest of the build runs once per option.
    common = list(placed)
    for opt in ("A", "B"):
        placed[:] = list(common)
        sdev = f"{dev} {opt}"
        if opt == "A":
            path(sdev, "amp + 470 uF", m.amp, legs(((0, 0, 1), 3, 2), ((0, 1, 0), 110)), [("body", m.body)] + placed)
            placed.append(("amp", m.amp))
            snd = m.speaker + m.cup
            path(sdev, "speaker in its cup", snd, legs(((-1, 0, 0), 5, 5), ((0, 1, 0), 110)), [("body", m.body)] + placed)
        else:
            snd = m.buzz_disc + m.buzzer
            path(sdev, "buzzer in its disc", snd, legs(((-1, 0, 0), 4, 5), ((0, 1, 0), 110)), [("body", m.body)] + placed)
        placed.append(("sound", snd))
        build_rest(sdev, m, placed)


def build_rest(dev, m, placed):
    """Scoreboard from the main board to the cover (runs once per sound option)."""
    frame, proper = board_frame(lambda x, y: (m.gx(x), m.gy(y)), m.mb_top)
    report(dev, "board placement", proper, "rotation" if proper else
           "MIRRORED: the model's board can't exist with parts up; checking the real board (same USB end) instead")
    asm, slab, under, plugs, _ = board_parts(True, plugs=False)
    lip_y = lip_side(m.body, frame, m.MB_LIP_X)
    report(dev, "retention found", True, f"fixed lips over real board edge y={lip_y}" if lip_y is not None else
           "no fixed lips: snap-in, straight down")
    body_flex = m.body
    for z in flex_zones(frame, m.MB_CLIP_X, m.MB_LIP_X, None if lip_y is None else 30 - lip_y):
        body_flex = body_flex - z
    # v5: no port in the left wall. The C-C extension's male end (25 straight) leaves only 5.4 to the wall, less than
    # its ~6.5 mating length, so it's plugged into the XIAO in hand and goes in with the board, held 16 up (12 hits a post)
    board = frame * asm
    path(dev, "board roll-in + USB male end", board + m.usb_plug,
         roll_in(frame, lip_y, drop=16.0, approach=((0, 1, 0), 110)), [("body", body_flex)] + placed)
    path(dev, "board underside joints", frame * under, [Pos(0, 0, 0)], [("body", body_flex)], tol=0.05)
    path(dev, "USB male end in the port", m.usb_plug, [Pos(0, 0, 0)], [("body", m.body), ("board", frame * slab)], tol=0.05)
    placed += [("board", board), ("USB male end", m.usb_plug)]
    cols = [frame * c for c in plugs]
    for i, c in enumerate(cols):
        path(dev, f"Dupont plug {i + 1}", c, legs(((0, 0, 1), 12, 3), ((0, 1, 0), 110)),
             [("body", m.body)] + [p for p in placed if p[0] != "board"])
    placed += [(f"plug {i + 1}", c) for i, c in enumerate(cols)]
    path(dev, "battery shelf", m.shelf, legs(((0, 0, 1), 4, 3), ((0, 1, 0), 110)), [("body", m.body)] + placed)
    placed.append(("shelf", m.shelf))
    path(dev, "battery holder (slides in)", m.bat, linear((0, 1, 0), 110), [("body", m.body)] + placed)
    placed.append(("holder", m.bat))
    path(dev, "USB cable route", m.usb_cable, [Pos(0, 0, 0)],    # it leaves the male end's back: not an obstacle
         [("body", m.body)] + [p for p in placed if p[0] != "USB male end"])
    # the extension's female end drops into the cover's clip from above, outside the case; then the cover goes on with it
    path(dev, "USB female end into the cover clip", m.usb_female, linear((0, 0, 1), 30, 6), [("cover", m.cover)])
    path(dev, "back cover + USB female end", m.cover + m.usb_female, linear((0, 1, 0), 30, 6),
         [("body", m.body)] + placed, tol=3.0)


if __name__ == "__main__":
    which = sys.argv[1:] or ["insert", "sled", "scoreboard"]
    for w in which:
        try:
            {"insert": check_insert, "sled": check_sled, "scoreboard": check_scoreboard}[w]()
        except (AttributeError, NameError, ValueError, KeyError) as e:   # a renamed model parameter: update check.py
            report(w, "model contract", False, f"{type(e).__name__}: {e}")
    print(f"\n{RESULTS.count(True)} pass, {RESULTS.count(False)} fail")
    sys.exit(0 if all(RESULTS) else 1)
