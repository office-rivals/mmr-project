"""The scoreboard's sounds v2 (ux/SOUNDS-V2.md), in the spec's order: ux's reference WAVs, unchanged.
Re-render them in ux first if the spec changed: cd ux && uv run sounds.py"""
import sys
from pathlib import Path

UX = Path(__file__).resolve().parents[3] / "ux"
sys.path.insert(0, str(UX.parent / "video/film/tools"))
import sound as S  # noqa: E402

EARCONS = {n: S.read(UX / "out/sounds" / f"{n}.wav") for n in ("goal", "won", "undo", "scan", "joined", "not_joined", "saved")}
