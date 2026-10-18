"""Print ASSEMBLY.md's §3.1 parts table and §3.6 net table from perfboard.py (1-based holes), so the guide can't
drift from the layout. Run: uvx --from matplotlib python assembly_tables.py
"""
import sys

sys.argv = ["perfboard.py"]
exec(open("perfboard.py").read().split("fig, (top, bot)")[0])

h1 = lambda h: f"({h[0] + 1},{h[1] + 1})"
NOTE = {   # how to fit each part (label prefix -> text); body over the FIRST hole listed for standing parts
    "R2": "Either way", "C2": "Either way", "R1": "Either way",
    "J_PT": "Pins up. **RX** {a}, **−** {b}", "J_LED": "Pins up. **A** {a}, **−** {b}",
    "J_BAT": "**JST-PH 2-pin pigtail** (the socket half of an Adafruit 1131 cable) soldered in: **red +** {a}, **black −** {b}; hole (19,1) stays empty. Meter its polarity first (step 4.4)",
    "D1": "Standing, body over {a}, **stripe (cathode) up into {b}**",
    "C1": "Standing: **+ (long lead) {a}**, − (stripe) {b}. Wrong way round it can burst",
    "R_LED": "Machined socket 1 × 2 (part of the 1 × 4 strip on this row)", "R_PU": "Machined socket (the strip's right half)",
    "R_LED_B": "Machined socket 1 × 2, right under R_LED", "R_PU_B": "Standing, body over {a}. Beam pull-up B (daylight mode)",
    "C_RX": "Either way, right above J_PT", "R_S8": "Standing, body over {a}. Beam node → D8", "R_S2": "Standing, body over {a}. Beam node → D2",
    "R_VB1": "Standing. USB sense, 5V side", "R_VB2": "Standing",
    "R_BTN": "Standing, body over {a}. Undo-button pull-up", "R_BS": "Standing, body over {a}. 1 kΩ at the board end of the button lead", "C_BTN": "Either way, between J_LED and J_BAT",
    "J_BTN": "Pins up. **−** {a}, **BTN** {b}", "J_BZ": "Pins up. **+** {a}, **−** {b}",
    "D3": "Standing, body over {a}, **stripe (cathode) into {a}**. The buzzer's flyback diode",
    "R_BD": "Standing, body over {a}. Keeps the buzzer silent at boot",
    "Q2": "Standing in a column, **flat side towards the USB end**: C {a}, B {m}, E {b}", "R_B": "Standing, body over {a}",
    "J_OLED": "**5-pin header, pull out pin 5** at {b} (the key). **SCL** {a}, **G**, **SDA**, **V** to the right",
    "R_SCL": "Standing, body over {a}", "R_SDA": "Standing, body over {a}",
    "J_STAT": "Pins up. **RA** {a} (red anode, through R_R), **S** {m}, **−** {b}", "R_R": "Standing, body over {a}. The red status LED's resistor, at the board end of its lead", "R_S": "Standing, body over {a}. In the GPIO5 (MTDI) line",
}
print("| Part | Holes (column, row) | How |\n|---|---|---|")
for label, a, b, _ in PARTS:
    name = label.split()[0]
    m = ((a[0] + b[0]) // 2, (a[1] + b[1]) // 2)
    note = NOTE[name].format(a=h1(a), b=h1(b), m=h1(m))
    print(f"| **{label}** | {h1(a)}–{h1(b)} | {note} |")

PADS = {(5, 5): "XIAO BAT+ wire", (5, 6): "XIAO BAT− wire", (4, 7): "XIAO MTCK wire", (2, 6): "XIAO MTMS wire",
        (3, 4): "XIAO MTDO wire", (2, 5): "XIAO MTDI wire"}
where = {}
for label, a, b, _ in PARTS:
    for c in range(min(a[0], b[0]), max(a[0], b[0]) + 1):
        for r in range(min(a[1], b[1]), max(a[1], b[1]) + 1):
            pin = PIN_NOTES.get((c, r), "")
            pin = pin.replace("K|", "K, stripe")
            where.setdefault((c, r), label.split()[0] + (f" {pin}" if pin and label.startswith(("J_", "Q2", "D", "C1")) else ""))
print("\n| Net | Wire these points, run by run (1-based holes) |\n|---|---|")
for net, chains in NETS.items():
    runs = []
    for ch in chains_of(chains):
        pts = []
        for p in ch:
            if p[0] == "w":
                continue
            if isinstance(p, str):
                part, pin = p.split(":")
                pts.append(f"XIAO {pin}" if part == "X" else f"LIS3DH {pin.replace('GND2', 'GND')} {h1(LIS[pin])}")
            else:
                pts.append(f"{PADS.get(p) or where.get(p, '?')} {h1(p)}")
        runs.append(" · ".join(pts))
    print(f"| **{net}** | " + " ; ".join(runs) + " |")
