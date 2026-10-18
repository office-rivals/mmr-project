# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=10.1", "matplotlib", "segno"]
# ///
"""The board's screens for the sounds preview, drawn by ux's generator (ux/mockups.py): ux's own screens plus the
scoreboard film's states (one story: Alice, Bob, Carol, Dave; an unknown badge; 7:5 -> goal 8:5 -> undo -> 9:7 -> won).

    uv run tools/screens.py     # -> assets/screens/*.png
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VIDEO = ROOT.parents[1]
sys.path.insert(0, str(VIDEO.parent / "ux"))
sys.path.insert(0, str(VIDEO / "scoreboard/tools"))
import mockups as M  # noqa: E402
import screens as SB  # noqa: E402  (the scoreboard film's states, same drawing code)

M.OUT = ROOT / "assets/screens"
ux = dict(M.SCREENS)
SHOTS = {
    "lobby": ux["18-lobby-empty"],
    "alice-joined": lambda d: M.lobby(d, ["Alice"], toast="✓  Alice joined"),
    "bob-joined": ux["18b-lobby-joined"],
    "unknown": ux["21-unknown-badge"],
    "carol-joined": lambda d: M.lobby(d, M.FULL[:3], toast="✓  Carol joined"),
    "dave-joined": lambda d: M.lobby(d, M.FULL, toast="✓  Dave joined"),   # All in: Choose / Random / Fair
    "teams": ux["19-teams"],
    **{k: SB.FILM[k] for k in ("live-7-5", "goal", "live-8-5", "undo", "live-9-7", "saving-8", "saving-6", "saving-4", "saving-2", "saved")},
}

if __name__ == "__main__":
    M.OUT.mkdir(parents=True, exist_ok=True)
    for name, draw in SHOTS.items():
        _, img = M.screen(name, draw)
        assert img.size == (M.W, M.H), name
    print(f"ok: {len(SHOTS)} screens -> {M.OUT}")
