"""Scoreboard v5 on the end shelf (photos shelf-11..13, user's flat = 95): fit figure + a render of the real model.

    uv run python shelf_fit.py      # out/shelf_fit.png (side profile + top view), out/shelf_fit_v5.png

Scene frame = the scoreboard's: x across (+ = right seen from the playfield: the table corner, the side panel), y from the
playfield edge outward, z up from the shelf top. The bead counter is to the LEFT of the scoreboard.
"""
import math
from pathlib import Path

from build123d import Align, Box, Cylinder, Plane, Polygon, Pos, Rot, extrude
from render import render
import scoreboard as sb

R_NOSE, RAIL_H = 28.0, 60.0                       # outer edge radius (estimate from the tape over the curve), rail depth shown
PANEL_X = sb.W + sb.COUNTER[1]                    # side panel's inner face (2 mm clearance)
COUNTER_X1 = PANEL_X - sb.COUNTER[0]              # the bead counter's end cube (free length 170 at this end)
BEAD = (25.0, 53.0)                               # cube size, row centre y (shelf-11/12)
OUT = Path(__file__).parent / "out"


def xprism(pts, x0, x1):          # YZ polygon extruded along x from x0 to x1
    return Pos(x0, 0, 0) * extrude(Plane.YZ * Polygon(*pts, align=None), x1 - x0, dir=(1, 0, 0))   # explicit dir: winding-proof


def rail_profile(n=16):
    f = sb.SHELF_FLAT
    return [(0, 0), (f, 0)] + [(f + R_NOSE * math.sin(a), -R_NOSE + R_NOSE * math.cos(a))
                               for a in [math.pi / 2 * i / n for i in range(1, n + 1)]] + [(f + R_NOSE, -RAIL_H), (0, -RAIL_H)]


def main():
    import matplotlib.pyplot as plt
    from matplotlib.patches import Polygon as Pg, Rectangle
    OUT.mkdir(exist_ok=True)
    t = sb._T
    prof = [(0, 0), (0, sb.FRONT_H), (sb.F * math.cos(t), sb.H), (sb.DEPTH + sb.WALL, sb.H), (sb.DEPTH + sb.WALL, 0)]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(14, 5.6), gridspec_kw=dict(width_ratios=[1, 1.35]))
    a1.add_patch(Pg(rail_profile(), fc="#e8d5bf", ec="#8a6f50"))
    a1.add_patch(Rectangle((-30, -RAIL_H), 27, RAIL_H + 25, fc="#f0f0f0", ec="#999"))
    a1.text(-16, 30, "playfield\n(goalie rod)", ha="center", fontsize=8, color="#666")
    a1.add_patch(Pg(prof, fc="#5e81ac", alpha=0.35, ec="#2e4a6e", lw=2))
    for ty in sb.TAPE_Y:
        a1.add_patch(Rectangle((ty, -1.5), 19, 1.5, fc="#bf616a"))
    a1.axvline(sb.SHELF_FLAT, color="#8a6f50", ls=":", lw=1)
    a1.text(sb.SHELF_FLAT, -RAIL_H - 6, f"end of flat {sb.SHELF_FLAT:.0f}", ha="center", va="top", fontsize=8)
    a1.text(5, sb.H + 6, f"v5: {sb.DEPTH + sb.WALL:.0f} D x {sb.H:.0f} H, {sb.TILT_DEG:.0f}°, front wall {sb.FRONT_H:.0f}", color="#2e4a6e", fontsize=9)
    a1.text(30, -10, "tape strips", color="#bf616a", fontsize=8)
    a1.set_aspect("equal"); a1.set_xlim(-35, 135); a1.set_ylim(-RAIL_H - 15, sb.H + 15)
    a1.set_title("Side profile across the rail (face toward the playfield)", fontsize=10, loc="left")
    a1.set_xlabel("y, mm from the playfield edge")
    # top view, seen from above with the playfield at the bottom: x = left/right as seen from the playfield
    a2.add_patch(Rectangle((COUNTER_X1 - 120, 0), PANEL_X + 45 - COUNTER_X1 + 120, sb.SHELF_FLAT, fc="#e8d5bf", ec="#8a6f50"))
    a2.add_patch(Rectangle((COUNTER_X1 - 120, sb.SHELF_FLAT), PANEL_X + 45 - COUNTER_X1 + 120, R_NOSE, fc="#d9c2a6", ec="#8a6f50"))
    a2.add_patch(Rectangle((PANEL_X, -5), 45, sb.SHELF_FLAT + R_NOSE + 10, fc="#c9b08f", ec="#8a6f50"))
    a2.text(PANEL_X + 22, 60, "side\npanel", ha="center", fontsize=8, rotation=90)
    for k in range(5):
        a2.add_patch(Rectangle((COUNTER_X1 - 25 - 26 * k, BEAD[1] - 12.5), 25, 25, fc="#a0522d"))
    a2.text(COUNTER_X1 - 70, BEAD[1] + 18, "<- bead counter (kept)", fontsize=8)
    a2.add_patch(Rectangle((0, 0), sb.W, sb.DEPTH + sb.WALL, fc="#5e81ac", alpha=0.35, ec="#2e4a6e", lw=2))
    a2.add_patch(Rectangle((sb.W_MAIN, 0), sb.WING, sb.DEPTH + sb.WALL, fc="none", ec="#2e4a6e", ls=":"))
    a2.text(sb.W_MAIN + sb.WING / 2, 20, "wing:\nbadge\n(+ speaker\non the wall)", ha="center", fontsize=7)
    a2.text(sb.W_MAIN / 2, 30, "screen + LED bar + 4 keys", ha="center", fontsize=8)
    a2.annotate(f"{-COUNTER_X1:.0f} mm to the counter (phone tag on this wall)", (0, 70), (-150, 110), fontsize=8,
                arrowprops=dict(arrowstyle="-", color="#666"))
    a2.set_aspect("equal"); a2.set_xlim(COUNTER_X1 - 140, PANEL_X + 55); a2.set_ylim(-10, sb.SHELF_FLAT + R_NOSE + 30)
    a2.set_title(f"Top view, right end (free {sb.COUNTER[0]:.0f}); playfield at the bottom", fontsize=10, loc="left")
    a2.set_xlabel("x, mm (0 = the scoreboard's left wall)")
    fig.tight_layout(); fig.savefig(OUT / "shelf_fit.png", dpi=110); plt.close(fig)

    rail = xprism(rail_profile(), COUNTER_X1 - 160, PANEL_X + 45)
    panel = Pos(PANEL_X, -5, -RAIL_H) * Box(45, sb.SHELF_FLAT + R_NOSE + 10, RAIL_H + 1, align=(Align.MIN,) * 3)
    wall = Pos(COUNTER_X1 - 160, -3, -RAIL_H) * Box(PANEL_X + 45 - COUNTER_X1 + 160, 3, RAIL_H, align=(Align.MIN,) * 3)
    beads = [Pos(COUNTER_X1 - 12.5 - 26 * k, BEAD[1], 0) * Box(BEAD[0], BEAD[0], BEAD[0], align=(Align.CENTER, Align.CENTER, Align.MIN))
             for k in range(5)]
    rod = Pos(COUNTER_X1 - 160, BEAD[1], 12.5) * Rot(0, 90, 0) * Cylinder(3, 160, align=(Align.CENTER, Align.CENTER, Align.MIN))
    shelf = [(rail, "#e8d5bf", 1), (panel, "#c9b08f", 1), (beads + [rod], "#a0522d", 1), (wall, "#f0f0f0", 1)]
    board = [(sb.body, "#3b4252", 1), (sb.cover, "#5b6478", 1), (sb.paper, "#e8e6df", 1), (sb.caps, "#d08770", 1),
             (sb.diffuser, "#f2f2f2", 1), (sb.tile, "#f5f0e1", 1), (sb.window, "#cfe8f2", 0.1), (sb.win_mask, "#3b4252", 1), (sb.rim, "#3b4252", 1)]
    render(OUT / "shelf_fit_v5.png", shelf + board, view=(-0.35, -1, 0.6), size=(1100, 750),
           title=f"v5 at the rail's right end: {sb.W:.0f} W x {sb.DEPTH + sb.WALL:.0f} D x {sb.H:.0f} H, beside the bead counter")
    print(f"v5 {sb.W:.0f} x {sb.DEPTH + sb.WALL:.1f} x {sb.H:.1f}; {-COUNTER_X1:.0f} mm to the counter; flat {sb.SHELF_FLAT:.0f}")


if __name__ == "__main__":
    main()
