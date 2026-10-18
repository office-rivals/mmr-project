"""Generation check (review 2, B1): wiring.yml must say what perfboard.py builds.
Run: uvx --with pyyaml --with matplotlib python check_wiring.py   (exit 1 on any mismatch)

- every flow-list label parsed as one label (no comma splits): BOARD has 18, J_STAT 3, J_OLED 4;
- every U1 / U2 pin lands on the BOARD label that perfboard.py's NETS give that pin;
- every board header's pinlabels are the nets of its holes, in hole order (pulled pins skipped).
"""
import sys

import yaml

sys.argv = ["perfboard.py"]   # goal board
src = open("perfboard.py").read().split("fig, (top, bot)")[0]
exec(src)

W = yaml.safe_load(open("wiring.yml"))
C = W["connectors"]
PADS = {"BAT+": (5, 5), "BAT−": (5, 6), "MTCK": (4, 7), "MTMS": (2, 6), "MTDO": (3, 4), "MTDI": (2, 5)}
errors = []


def net_of(h):
    for net, chains in NETS.items():
        for ch in chains_of(chains):
            if any(p[0] != "w" and hole(p) == h for p in ch):
                return net
    return None


def expect(cond, msg):
    if not cond:
        errors.append(msg)


for name, n in (("BOARD", 18), ("J_STAT", 3), ("J_OLED", 4), ("U1", 19)):
    expect(len(C[name]["pinlabels"]) == n, f"{name} has {len(C[name]['pinlabels'])} labels, not {n}")

for row in W["connections"]:
    ends = [list(d.items())[0] for d in row]
    (a, pa), (b, pb) = ends[0], ends[-1]
    if a in ("U1", "U2") and b == "BOARD":
        for i, j in zip(pa, pb):
            pin = C[a]["pinlabels"][i - 1]
            h = PADS.get(pin) or (XIAO[pin] if a == "U1" else LIS[pin])
            want, got = net_of(h), C["BOARD"]["pinlabels"][j - 1]
            expect(want == got, f"{a}.{pin} -> BOARD.{got}, perfboard says {want}")

parts = {lab.split()[0]: (a, b) for lab, a, b, _ in PARTS}
for name, conn in C.items():
    if not name.startswith("J_"):
        continue
    (c1, r1), (c2, r2) = parts[name]
    holes = [(c, r) for c in range(min(c1, c2), max(c1, c2) + 1) for r in range(min(r1, r2), max(r1, r2) + 1)]
    nets = [net_of(h) for h in holes if h not in PULLED and h not in NOPIN]
    expect(nets == conn["pinlabels"], f"{name} pinlabels {conn['pinlabels']} vs perfboard {nets}")

for e in errors:
    print("MISMATCH:", e)
print(f"{len(errors)} mismatches" if errors else "wiring.yml matches perfboard.py (BOARD 18 labels, every endpoint)")
sys.exit(1 if errors else 0)
