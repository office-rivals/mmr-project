"""Offscreen VTK renders of build123d shapes, shared by insert.py and scoreboard.py."""


def render(path, items, view=(-0.55, -0.75, 0.5), up=(0, 0, 1), lines=(), title="", size=(1200, 900),
           transparent=False):
    """Offscreen VTK render. items: (shape or [shapes], colour, opacity); view: camera direction."""
    import numpy as np
    import pyvista as pv

    p = pv.Plotter(off_screen=True, window_size=size)
    p.set_background("white")
    for shapes, color, opacity in items:
        for s in (shapes if isinstance(shapes, list) else [shapes]):
            v, t = s.tessellate(0.2, 0.2)
            mesh = pv.PolyData(np.array([(q.X, q.Y, q.Z) for q in v]),
                               np.hstack([[3, *tri] for tri in t]))
            p.add_mesh(mesh, color=color, opacity=opacity, specular=0.2)
            p.add_mesh(mesh.extract_feature_edges(30), color="#222222", line_width=1)
    for a, b in lines:
        p.add_mesh(pv.Line(a, b), color="#999999", line_width=2)
    p.view_vector(view, viewup=up)
    p.enable_parallel_projection()
    p.reset_camera()
    p.camera.zoom(1.15)
    if title:
        p.add_text(title, font_size=11, color="black", position="upper_edge")
    p.screenshot(str(path), transparent_background=transparent)
    p.close()
