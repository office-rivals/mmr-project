# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=10.1", "matplotlib", "segno"]
# ///
"""The teaser's one new board screen, drawn by ux's generator (ux/mockups.py). The others are copies of the
scoreboard film's (`../scoreboard/assets/screens/`).

    uv run tools/screens.py     # -> assets/screens/allin-modes.png

allin-modes: "All in!" with the three ways to make teams (user decision 2026-10-15). PROVISIONAL key labels
(lead's example: K2 Choose / K3 Random / K4 Fair) until ux's spec lands; redraw then.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT.parents[1] / "ux"))
import mockups as M  # noqa: E402

M.OUT = ROOT / "assets/screens"

if __name__ == "__main__":
    _, img = M.screen("allin-modes", lambda d: M.lobby(d, M.FULL, toast="✓  Dave joined", keys=[M.REMOVE, "Choose", "Random", "Fair"]))
    assert img.size == (M.W, M.H)
    print(f"ok: allin-modes -> {M.OUT}")
