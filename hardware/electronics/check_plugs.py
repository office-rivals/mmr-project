"""Cross-plug check (review 2): every Dupont lead's housing, seated anywhere along every header row (both ways round),
must harm nothing. Run: python3 check_plugs.py (exit 1 and a list on any harmful case).

A housing seats where none of its plugged cavities sits on a pin and none of its cavities sits over a part body
(the rows below are the board as built in perfboard.py; '#' = a body or the board edge, '.' = empty hole).
Nets are (V_high, R_source, V_low, R_sink); a lead is a set of paths between its cavities with a forward drop,
series resistance, current limit and reverse-voltage limit. NiMH/alkaline only: pack ≤ 4.8 V, VSYS ≤ 4.65 V.
The battery uses a polarized, latching JST-PH pair (round 3): it mates nothing else, and J_BAT has no Dupont pins.
"""
import sys

NETS = {"VPACK": (4.8, 0, 3.0, 0), "VSYS": (4.65, 0, 3.0, 0), "3V3": (3.3, 0, 3.3, 0), "GND": (0, 0, 0, 0),
        "BZ-": (4.65, 16, 0, 0),             # through the coil when Q2 is off, Q2 saturated when it's on
        "RX": (3.3, 52e3, 0, 52e3),          # beam node: 220k || 68k pull-ups, the GPIOs sit behind 1k
        "LED_A": (3.3, 330, 0, 330),         # R_LED_B 330 (boost) is the stiffest path
        "BTN": (3.3, 101e3, 0, 1e9),         # 100k pull-up + R_BS 1k, GPIO4 input
        "S": (3.3, 100, 0, 100),             # GPIO5 behind R_S 100
        "RA": (3.3, 680, 3.3, 680),         # 3V3 behind R_R 680 (round 3)
        "SCL": (3.3, 2.4e3, 0, 120), "SDA": (3.3, 2.4e3, 0, 120)}   # pull-ups / GPIO low through R_SCL, R_SDA 100
SINK_LIMIT = {"S": 0.04, "SCL": 0.04, "SDA": 0.04, "LED_A": 0.04}   # GPIO pin current limit behind its resistor

# Rows as soldered (perfboard.py, 0-based columns); pins named by net.
ROWS = {
    "row 0": ["#"] * 6 + ["."] * 4 + ["RX", "GND", ".", ".", "LED_A", "GND", "#", "#", ".", "#", "GND", "BTN", ".", "#"],   # J_BAT: JST-PH pigtail, no pins
    "row 3": ["#", "VSYS", "BZ-", "#"],
    "row 9": ["#"] * 10 + ["SCL", "GND", "SDA", "3V3", ".", "#", "RA", "S", "GND", "#"],
}
HEADERS = {"J_PT": ("row 0", 10), "J_LED": ("row 0", 14), "J_BTN": ("row 0", 20),
           "J_BZ": ("row 3", 1), "J_OLED": ("row 9", 10), "J_STAT": ("row 9", 16)}


def path(drop, r, imax, vr=None):
    return {"drop": drop, "r": r, "imax": imax, "vr": vr}


# lead: (cavity names, plugged cavities, {(from, to): path}); a path from->to conducts forward; the reverse of a
# diode-like path only sees its reverse-voltage limit.
LED_R = 47    # inline at the IR LED (review 2): caps a wrong plug on J_BZ at < 100 mA
LEADS = {
    "LED (TSAL6200 + 47 Ω)": (["A", "K"], set(), {("A", "K"): path(1.2, LED_R, 0.1, 5)}),
    "J_PT ext (TEFT4300)": (["C", "E"], set(), {("C", "E"): path(0, 660, 1.0, 5)}),   # photocurrent-limited
    "BTN (1 k + switch)": (["a", "b"], set(), {("a", "b"): path(0, 1000, 0.05), ("b", "a"): path(0, 1000, 0.05)}),
    "BZ (16 Ω coil)": (["a", "b"], set(), {("a", "b"): path(0, 13, 0.13), ("b", "a"): path(0, 13, 0.13)}),
    "STAT (green 220 inline; R_R on the board)": (["w1", "w2", "w3"], set(), {
        ("w1", "w2"): path(1.7, 0, 0.025, 5), ("w2", "w3"): path(2.5, 220, 0.025, 5),
        ("w1", "w3"): path(4.2, 220, 0.025, 10)}),
    "OLED (SCL G SDA V housing)": (["SCL", "G", "SDA", "V", "key"], {4}, {
        ("V", "G"): path(0, 150, 1.0, 0.6),                                       # the module itself; G > V = body diode
        ("G", "V"): path(0.6, 0, 0.01), ("G", "SCL"): path(0.6, 0, 0.01), ("G", "SDA"): path(0.6, 0, 0.01),
        ("SCL", "V"): path(0.6, 0, 0.01), ("SDA", "V"): path(0.6, 0, 0.01)}),
}


def placements(row, cavs, plugged):
    n = len(cavs)
    for rev in (False, True):
        order = list(range(n))[::-1] if rev else list(range(n))
        for start in range(-n + 1, len(row)):
            contacts, ok = {}, True
            for k, cav in enumerate(order):
                pos = start + k
                cell = row[pos] if 0 <= pos < len(row) else "."      # past the row's ends: free air
                if cell == "#" or (cav in plugged and cell not in ("#", ".")):
                    ok = False
                    break
                if cell not in ("#", ".") and cav not in plugged:
                    contacts[cavs[cav]] = cell
            if ok and len(contacts) >= 1:
                yield rev, start, contacts


def harms(name, lead, contacts):
    cavs, plugged, paths = lead
    if paths == "source":   # the battery lead: right way round on J_BAT, or reversed there (D1 blocks it, the 1M
        # divider clamps < 5 µA into D0); anything else with 2 contacts is a fault
        ok = ({"+": "VPACK", "-": "GND"}, {"+": "GND", "-": "VPACK"})
        return [] if len(contacts) < 2 or contacts in ok else [f"pack across {contacts}"]
    out = []
    for (a, b), p in paths.items():
        if a not in contacts or b not in contacts:
            continue
        na, nb = NETS[contacts[a]], NETS[contacts[b]]
        dv = na[0] - nb[2]
        i = max(0.0, dv - p["drop"]) / max(p["r"] + na[1] + nb[3], 1e-3)
        lim = min(p["imax"], SINK_LIMIT.get(contacts[b], 9), SINK_LIMIT.get(contacts[a], 9))
        if i > lim:
            out.append(f"{a}->{b} on {contacts[a]}->{contacts[b]}: {i * 1000:.0f} mA > {lim * 1000:.0f} mA")
        rev = NETS[contacts[b]][0] - NETS[contacts[a]][2]
        if p["vr"] is not None and (b, a) not in paths and rev > p["vr"]:
            out.append(f"{b}->{a} reverse {rev:.1f} V > {p['vr']} V on {contacts[b]}->{contacts[a]}")
    return out


# each lead's own header, seated straight (either way round): normal use, not a fault
OWN = {"BZ (16 Ω coil)": ("J_BZ", 2), "LED (TSAL6200 + 47 Ω)": ("J_LED", 2), "J_PT ext (TEFT4300)": ("J_PT", 2),
       "BTN (1 k + switch)": ("J_BTN", 2), "STAT (green 220 inline; R_R on the board)": ("J_STAT", 3)}
bad = []
for lname, lead in LEADS.items():
    for rname, row in ROWS.items():
        for rev, start, contacts in placements(row, lead[0], lead[1]):
            own = OWN.get(lname)
            if own and HEADERS[own[0]] == (rname, start) and len(contacts) == own[1]:
                continue
            for h in harms(lname, lead, contacts):
                bad.append(f"{lname} on {rname} at col {start}{' reversed' if rev else ''}: {h}")
for b in bad:
    print(b)
print(f"{len(bad)} harmful placements" if bad else "cross-plug check: every lead is harmless on every header")
sys.exit(1 if bad else 0)
