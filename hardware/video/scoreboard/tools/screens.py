# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=10.1", "matplotlib", "segno"]
# ///
"""The board's screens for the film, drawn by ux's own generator (ux/mockups.py) at the panel's 400 x 300.

    uv run tools/screens.py     # -> assets/screens/*.png

Most are ux's screens as-is; a few are film states (one story: Carol·Dave start left, swap, an own goal by
Carol, a 9:7 lead, Eve's new badge) made with the same drawing code, so nothing here invents a layout.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT.parents[1] / "ux"))
import mockups as M  # noqa: E402

M.OUT = ROOT / "assets/screens"
ux = dict(M.SCREENS)
R, ROSTER = M.ROSTER, M.ROSTER
SWAPPED = (R[1], R[0])


def goal(d, picked=None):
    """ux's goal_screen (08/09b) for the film's story: the LEFT team goes 7 -> 8, and Carol (right team) picked
    = an own goal. (ux's own story is the right team going 7 -> 8 and Alice's own goal.)"""
    d.rectangle((0, 0, M.W, M.STATUS[1]), fill=0)
    head = f"Oops! Own goal, {(R[0] + R[1])[picked]}" if picked is not None else "GOAL!  Who scored?"
    M.text_c(d, M.W / 2, 15, head, M.W - 20, 26, M.F_GOAL, fill=1)
    M.score(d, 8, 5)
    M.labels(d, [("✓ " if i == picked else "") + k for i, k in enumerate(R[0] + R[1])], pressed=picked)


def live(a, b):
    return lambda d: (M.score(d, a, b, ROSTER), M.labels(d, [M.UNDO, "", "", M.NEW]))


def saving(n):
    return lambda d: (M.score(d, 10, 7, ROSTER, winner=0), M.summary(d, 566, "Alice", winner=0),
                      M.labels(d, [M.UNDO, "", "", ""]), M.submit_note(d, f"Saving to MMR\nin {n} s"))


FILM = {
    "idle": ux["01b-idle-claimed"],
    "waking": lambda d: (M.status(d, "Last game", [lambda d, x: M.wifi(d, x, dots=True)]), M.score(d, 10, 7, ROSTER),
                         M.text_c(d, M.W / 2, sum(M.LABEL) / 2, M.IDLE_HINT, M.W - 20, M.LABEL[1] - M.LABEL[0], M.F_STATUS)),
    "lobby": ux["18-lobby-empty"],
    "bob-joined": ux["18b-lobby-joined"],
    "carol-joined": lambda d: M.lobby(d, M.FULL[:3], toast="✓  Carol joined"),
    "dave-joined": lambda d: M.lobby(d, M.FULL, toast="✓  Dave joined"),
    "teams-made": lambda d: (M.status(d, M.TEAMS_STRIP["fair"]), M.score(d, 0, 0, SWAPPED), M.labels(d, [M.REMOVE, M.SWAP, "", ""])),
    "teams": ux["19-teams"],
    "live-7-5": ux["04-live"],
    "goal": goal,
    "own-goal": lambda d: goal(d, picked=2),
    "live-8-5": live(8, 5),
    "undo": lambda d: (M.message(d, "Undo last goal?", "8 : 5   →   7 : 5"), M.labels(d, ["Cancel", "", "", M.UNDO])),   # ux 10 follows ux's 5 : 8 story
    "live-9-7": live(9, 7),
    "saving-8": ux["12d-finished-saving"],
    "saving-6": saving(6), "saving-4": saving(4), "saving-2": saving(2),
    "saved": ux["12c-finished-claimed"],
    "lobby-ab": lambda d: M.lobby(d, M.LOBBY),
    "unknown": ux["21-unknown-badge"],
    "eve-in": lambda d: M.lobby(d, M.LOBBY + ["Eve"]),
    "flat": ux["16-change-batteries"],
}

if __name__ == "__main__":
    M.OUT.mkdir(parents=True, exist_ok=True)
    for name, draw in FILM.items():
        _, img = M.screen(name, draw)      # fit() asserts every text fits, as in ux
        assert img.size == (M.W, M.H), name
    print(f"ok: {len(FILM)} screens -> {M.OUT}")
