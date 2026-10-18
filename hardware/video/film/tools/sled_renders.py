"""The goal-counter film's sled stills, from mechanical's own model (mechanical/sled.py), without titles and with a
transparent background, at film size. Writes only into this film's assets; mechanical's folder is only read.

    UV_PROJECT_ENVIRONMENT="$PWD/.venv-cad" PYTHONDONTWRITEBYTECODE=1 uv run --project ../../mechanical python tools/sled_renders.py

Also writes assets/sled/points.json: where named points of the model land in each still (pixels), found by rendering
marker spheres at them, so the HTML can put a ball, the beam or a glow on the right spot.
"""
import json, sys
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "assets/sled"
sys.path.insert(0, str(HERE.parents[2] / "mechanical"))
import sled as M  # noqa: E402  (builds the geometry; writes nothing on import)
from build123d import Pos, Sphere  # noqa: E402


def render(path, items, view, up, size, zoom=1.15):
    """mechanical/render.py's offscreen VTK render, with a zoom (its camera fits the bounding sphere, so a long part seen
    end-on comes out tiny) and always a transparent background, no title."""
    import pyvista as pv
    p = pv.Plotter(off_screen=True, window_size=size)
    p.set_background("white")
    for shapes, color, opacity in items:
        for sh in (shapes if isinstance(shapes, list) else [shapes]):
            v, t = sh.tessellate(0.2, 0.2)
            mesh = pv.PolyData(np.array([(q.X, q.Y, q.Z) for q in v]), np.hstack([[3, *tri] for tri in t]))
            p.add_mesh(mesh, color=color, opacity=opacity, specular=0.2)
            if opacity:
                p.add_mesh(mesh.extract_feature_edges(30), color="#222222", line_width=2)
    p.view_vector(view, viewup=up)
    p.enable_parallel_projection()
    p.reset_camera()
    p.camera.zoom(zoom)
    p.screenshot(str(path), transparent_background=True)
    p.close()

rt = M.rt
# mechanical's own part groups and colours (sled.py's render block, final 2026-10-18: AA drawer, L 54, the dash with the 0.91" upright OLED, R's lead loop bay)
ELEC = [(M.board, "#2e7d32", 1), (M.xiao + M.lis3dh, "#37474f", 1), (M.parts3d + M.ph_pair, "#222222", 1),
        (M.emitter + M.em_legs, "#bf616a", 1)]
DPARTS = [(M.module, "#111111", 1), (M.active, "#e5e9f0", 1), (M.hdr + M.housing, "#ebcb8b", 1), (M.pair_bay, "#a3be8c", 1), (M.leds[0], "#a3be8c", 1), (M.leds[1], "#bf616a", 1),
          (M.buzzer, "#222222", 1),
          (M.sw_plate, "#4c566a", 1), (M.switch, "#5e81ac", 1),
          (M.keycap, "#d08770", 1)]
DRW = [(M.drawer, "#ebcb8b", 1), (M.holder, "#424242", 1)]
DRW_OUT = [(M.DRAWER_OUT * M.drawer, "#ebcb8b", 1), (M.DRAWER_OUT * M.holder, "#424242", 1), (M.lead_out, "#bf616a", 1),
           (M.tether_tube(125.0), "#eceff4", 1)]   # + its wired lead and the stop cord, as mechanical's drawer-out
DASH = (M.dash, "#81a1c1", 1)
L, LID, R = (M.part_l, "#88c0d0", 1), (M.lid, "#a3c9d6", 1), (M.part_r + M.cart, "#5e81ac", 1)
FLOOR = lambda s1: (rt.box(0, s1, -rt.W - 3, rt.GAP + 3, -3, 0), "#e8dcc8", 1)   # noqa: E731
TUNNEL = (rt.box(0, 340, -rt.W, rt.GAP, -3, 0) + rt.box(0, 340, rt.GAP, rt.GAP + 3, -3, rt.TUNNEL[1]) +
          rt.box(0, 340, -rt.W - 3, -rt.W, -3, rt.TUNNEL[1]), "#e8dcc8", 0.35)

NOSE = rt.box(0, 75, -200, 50, -10, 100)   # the front shot keeps only L's first 75 mm (else its long top fills the frame)
# name: (items, view, up, size, {point: (s, y, z)}); the zoom is fitted so the model fills ~92 % of the frame
BALL_Y = -rt.BLK - rt.GATE / 2          # the channel's centre line
SHOTS = {
    "exploded": (None, (-0.6, 0.55, 0.65), (0, 0, 1), (1800, 1200), {}),
    "tunnel": ([TUNNEL, (M.part_l + M.lid + M.dash, "#88c0d0", 1), (M.drawer, "#ebcb8b", 1), R], (-0.35, 0.55, 0.75),
               (0, 0, 1), (1800, 1350), {}),
    "closed": ([(M.part_l + M.lid + M.dash, "#88c0d0", 1), (M.drawer, "#ebcb8b", 1), R], (-0.35, 0.55, 0.75), (0, 0, 1),
               (1600, 1200), {}),   # scene 5's icon
    "top": ([FLOOR(330), L, R] + ELEC + DRW, (0, 0, 1), (0, 1, 0), (1800, 1000),
            {"beam_l": (rt.BEAM, -rt.BLK, rt.BEAM_Z), "beam_r": (rt.BEAM, rt.Y_POD, rt.BEAM_Z),
             "v_back": (rt.S_END, 0, rt.BEAM_Z), "v_front": (rt.BEAM, -rt.BLK, rt.BEAM_Z),
             "ch_back": (330, BALL_Y, 18), "ch_beam": (rt.BEAM, BALL_Y, 18), "ch_front": (rt.Q0 + 18, BALL_Y, 18),
             "in": (320, -40, 18)}),
    # the front, from a little above, as through the frame: the dash (MX key, OLED, LEDs; "grille" = where the buzzer's
    # port opens upward, under the OLED since 2026-10-18 13:32) + drawer
    "front": ([(M.part_l & NOSE, "#88c0d0", 1), (M.lid & NOSE, "#a3c9d6", 1), DASH] + DPARTS + DRW, (-1, 0, 0.45), (0, 0, 1), (1800, 1200),
              {"button": tuple(M.keycap.center()), "grille": (M.BUZ[0], M.BUZ[1], M.TOP), "oled": tuple(M.active.center())}),
    # the battery swap: the drawer pulled out (sled.DRAWER_OUT), then the same frame with it in (the pulled-out drawer
    # is there but invisible, so the camera frames both alike; main() also reuses drawer_out's zoom and crop)
    "drawer_out": ([L, LID, DASH] + DPARTS + DRW_OUT, (-0.7, 0.3, 0.6), (0, 0, 1), (1800, 1100), {}),
    "drawer_in": ([L, LID, DASH] + DPARTS + DRW + [(s, c, 0.0) for s, c, _ in DRW_OUT], (-0.7, 0.3, 0.6), (0, 0, 1),
                  (1800, 1100), {}),
}


def exploded():
    up = lambda dz, p: Pos(0, 0, dz) * p   # noqa: E731  (as mechanical's sled_exploded.png)
    return [L, (up(90, M.lid), "#a3c9d6", 1), (up(45, M.dash), "#81a1c1", 1), (up(45, M.module + M.active), "#111111", 1),
            (up(45, M.buzzer + M.hdr), "#222222", 1), (Pos(0, 0, 25) * (M.sw_plate + M.switch), "#4c566a", 1),
            (Pos(-30, 0, 45) * M.keycap, "#d08770", 1), (Pos(-90, 0, 0) * M.drawer, "#ebcb8b", 1),
            (Pos(-90, 0, 25) * M.holder, "#424242", 1), (up(25, M.board + M.xiao + M.lis3dh + M.parts3d + M.ph_pair), "#2e7d32", 1),
            (up(30, M.emitter + M.em_legs), "#bf616a", 1), (Pos(0, -60, 0) * M.part_r, "#5e81ac", 1),
            (Pos(0, -95, 0) * M.cart, "#3b4252", 1)]


def locate(items, view, up, size, pts, zoom):
    """Pixel position of each named point: render the same scene with a pure-magenta sphere there, diff against black."""
    from PIL import Image
    out = {}
    for name, p in pts.items():
        tmp = OUT / "_marker.png"
        dot = Pos(*p) * Sphere(2.5)
        # same items (so the camera frames identically) made invisible, plus the marker in magenta
        render(tmp, [(s, "#000000", 0.0) for s, _, _ in items] + [(dot, "#ff00ff", 1)], view=view, up=up, size=size, zoom=zoom)
        a = np.asarray(Image.open(tmp).convert("RGB")).astype(int)
        mask = (a[..., 0] > 200) & (a[..., 1] < 80) & (a[..., 2] > 200)
        ys, xs = np.nonzero(mask)
        assert len(xs), f"marker {name} not visible"
        out[name] = [round(float(xs.mean()), 1), round(float(ys.mean()), 1)]
        tmp.unlink()
    return out


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    points = {}
    from PIL import Image
    fit = {}
    for name, (items, view, up, size, pts) in SHOTS.items():
        items = items or exploded()
        if name == "drawer_in":
            zoom, (x0, y0, x1, y1) = fit["drawer_out"]
            render(OUT / f"{name}.png", items, view, up, size, zoom)
            im = Image.open(OUT / f"{name}.png")
        else:
            render(OUT / f"{name}.png", items, view, up, size, 1.0)
            b = Image.open(OUT / f"{name}.png").getchannel("A").getbbox()
            cx, cy = size[0] / 2, size[1] / 2      # the camera zooms about the frame's centre, not the model's
            zoom = 0.92 * min(cx / max(cx - b[0], b[2] - cx), cy / max(cy - b[1], b[3] - cy))
            render(OUT / f"{name}.png", items, view, up, size, zoom)
            im = Image.open(OUT / f"{name}.png")
            x0, y0, x1, y1 = im.getchannel("A").getbbox()
            assert x0 > 0 and y0 > 0 and x1 < im.width and y1 < im.height, f"{name}: zoom {zoom:.2f} cuts the model off"
            x0, y0, x1, y1 = max(0, x0 - 16), max(0, y0 - 16), min(im.width, x1 + 16), min(im.height, y1 + 16)
            fit[name] = zoom, (x0, y0, x1, y1)
        im.crop((x0, y0, x1, y1)).save(OUT / f"{name}.png")
        found = locate(items, view, up, size, pts, zoom)
        points[name] = {"size": [x1 - x0, y1 - y0], **{k: [x - x0, y - y0] for k, (x, y) in found.items()}}
        print("rendered", name, points[name]["size"])
    (OUT / "points.json").write_text(json.dumps(points, indent=1))
    # self-check: the beam's two ends sit on one vertical line in the top view, and the button is above the grille
    t, f = points["top"], points["front"]
    assert abs(t["beam_l"][0] - t["beam_r"][0]) < 3, t
    assert f["grille"][1] < f["button"][1], f   # the grille is on the dash's top, above the button
    assert points["drawer_in"]["size"] == points["drawer_out"]["size"], "the drawer pair must share one frame"
    print(f"ok: {len(SHOTS)} stills + points.json -> {OUT}")
